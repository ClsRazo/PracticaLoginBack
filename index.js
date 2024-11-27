const express = require("express"); // Se instala con npm install express
const cors = require("cors"); // Se instala con npm install cors
const bodyParser = require("body-parser"); // Se instala con npm install body-parser
// const mysql = require("mysql2"); // Se instala con npm install mysql2
//Para los JWT
const jwt = require("jsonwebtoken"); // Se instala con npm install jsonwebtoken
require("dotenv").config(); // Se instala con npm install dotenv
const crypto = require('crypto');
const nodemailer = require('nodemailer'); // Instalar con npm install nodemailer
const {Pool} = require('pg'); // Instalar con npm install pg
const { release } = require("os");

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// // Configuración para la BD
// const db = mysql.createConnection({
//   host: "localhost",
//   user: "root",
//   password: "280103Ac+",
//   database: "practica_login",
// });

// // Conexión a la BD
// db.connect((err) => {
//   if (err) {
//     console.error("Error de conexión: " + err.stack);
//     return;
//   }
//   console.log("Conexión exitosa a la BD");
// });

//Configuración para la BD en PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

//Verificar conexión a la BD
pool.connect((err, client, release) => {
  if(err){
    console.error("Error de conexión: " + err.stack);
    return;
  }
  console.log("Conexión exitosa a la BD");
  release();
});

module.exports = pool;

// Almacenamiento TEMPORAL EH de tokens de restablecimiento (usar base de datos)
const tokensRestablecimiento = {};

// Transporte de Nodemailer (usar configuración de servicio de correo)
const transporter = nodemailer.createTransport({
  //host para outlook
  // host: "smtp.office365.com",
  //host para gmail
  host: 'smtp.gmail.com',
  port: 465,
  // port: 587,
  secure: true, //False para 587, true para 465
  auth: {
    user: process.env.CORREO_USUARIO,
    pass: process.env.CORREO_CONTRASENA
  }
  });

transporter.verify().then(() => {
  console.log('Transporte de correo listo');
});


//Rutas
//------------------------------Raiz------------------------------
app.get("/", (req, res) => {
  res.send("Servidor Backend funcionando");
});

//------------------------------Para el login------------------------------
app.post("/login", (req, res) => {
  const {username, password} = req.body;

  //Checamos que exista el usuario en la BD
  const query = "SELECT * FROM usuarios where username = ?";
  //db. se usa para MySQL, para PostgreSQL se usa pool.
  pool.query(query, [username], (err, result) => {
    if (err) {
      console.error("Error en la consulta: " + err.stack);
      return res.status(500).json({error: "Error en la consulta"});
    }

    //Si no hay resultados
    if (result.length === 0) {
      return res.status(401).json({error: "Usuario no encontrado"});
    }

    //¿Puede ser que haya más de un usuario con el mismo nombre?
    //Si no, entonces solo habrá un resultado
    const usuario = result[0];
    if (usuario.password === password) {
      //Generamos el token y lo enviamos
      const token = jwt.sign({email: usuario.email, username: usuario.username}, process.env.JWT_SECRET, {expiresIn: "1h"});
      return res.json({message: "Login exitoso", token});
    } else {
      return res.status(401).json({error: "Contraseña incorrecta"});
    }
  });
});

//------------------------------Para el registro------------------------------
app.post("/register", (req, res) => {
  const {username, email, password} = req.body;

  //Comprobamos si el usuario ya existe
  const query = "SELECT * FROM usuarios WHERE username = ?";

  pool.query(query, [username], (err, results) => {
    if (err) {
      return res.status(500).json({error: "Error en la consulta"});
    }

    if (results.length > 0) {
      return res.status(400).json({error: "El usuario ya existe"});
    }

    //Creamos el nuevo usuario, pero solo registramos su correo y token
    //Generamos el token con el correo, usuario y contraseña
    const token = jwt.sign({email, username, password}, process.env.JWT_SECRET, {expiresIn: "1h"});

    //Enviamos el correo con el token

    //Creamos el usuario en la BD
    //La parte de la verificación queda para después
    const insertQuery = "INSERT INTO usuarios (username, email, password, token) VALUES (?, ?, ?, ?)";
    pool.query(insertQuery, [username, email, password, token], (err, result) => {
      if (err) {
        return res.status(500).json({error: "Error al registrar el usuario"});
      }
      res.status(201).json({message: "Usuario registrado correctamente"});
    });
  });
});

// ------------------------------Para solicitar restablecimiento de contraseña------------------------------
app.post('/solicitar-restablecimiento', (req, res) => {
  const { usuario, email } = req.body;
  
  console.log("Solicitud de restablecimiento recibida:", { usuario, email });

  // Verificar si el usuario existe
  const consulta = "SELECT * FROM usuarios WHERE username = ? AND email = ?";
  console.log("Consulta SQL:", consulta, "Valores:", [usuario, email]);

  pool.query(consulta, [usuario, email], (err, resultados) => {
    if (err) {
      console.log("Error en la consulta:", err);
      return res.status(500).json({ error: "Error en la consulta" });
    }

    if (resultados.length === 0) {
      console.log("Usuario no encontrado:", { usuario, email });
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    console.log("Usuario encontrado:", resultados);

    // Generar token de restablecimiento
    const tokenRestablecimiento = crypto.randomBytes(6).toString('hex');
    console.log("Token generado:", tokenRestablecimiento);
    
    // Almacenar token de restablecimiento con marca de tiempo
    tokensRestablecimiento[usuario] = {
      token: tokenRestablecimiento,
      creadoEn: Date.now()
    };
    console.log("Tokens almacenados:", tokensRestablecimiento);

    // Enviar correo
    const opcionesCorreo = {
      from: process.env.CORREO_USUARIO,
      to: email,
      subject: 'Restablecimiento de Contraseña',
      text: `Tu código de restablecimiento de contraseña es: ${tokenRestablecimiento}\n\n` +
            `Este código expirará en 15 minutos.`
    };

    transporter.sendMail(opcionesCorreo, (error, info) => {
      if (error) {
        console.log("Error al enviar el correo:", error);
        return res.status(500).json({ error: "Error al enviar el correo" });
      }
      
      console.log("Correo enviado con éxito:", info);
      res.json({ mensaje: "Código de restablecimiento enviado" });
    });
  });
});

// ------------------------------Para verificar token de restablecimiento------------------------------
app.post('/verificar-token-restablecimiento', (req, res) => {
  const { usuario, tokenRestablecimiento } = req.body;
  
  console.log("Verificación de token recibida:", { usuario, tokenRestablecimiento });

  const tokenGuardado = tokensRestablecimiento[usuario];
  console.log("Token guardado:", tokenGuardado);

  // Verificar si el token existe y no ha expirado (15 minutos)
  if (!tokenGuardado || 
      tokenGuardado.token !== tokenRestablecimiento || 
      (Date.now() - tokenGuardado.creadoEn) > 15 * 60 * 1000) {
    console.log("Token inválido o expirado:", { usuario, tokenRestablecimiento });
    return res.status(400).json({ error: "Token inválido o expirado" });
  }

  console.log("Token verificado correctamente");
  res.json({ mensaje: "Token verificado correctamente" });
});

// ------------------------------Para restablecer contraseña------------------------------
app.post('/restablecer-contrasena', (req, res) => {
  const { usuario, tokenRestablecimiento, nuevaContraseña } = req.body;
  
  console.log("Solicitud de restablecimiento de contraseña:", { usuario, tokenRestablecimiento, nuevaContraseña });

  const tokenGuardado = tokensRestablecimiento[usuario];
  console.log("Token guardado:", tokenGuardado);

  // Verificar token nuevamente
  if (!tokenGuardado || 
      tokenGuardado.token !== tokenRestablecimiento || 
      (Date.now() - tokenGuardado.creadoEn) > 15 * 60 * 1000) {
    console.log("Token inválido o expirado:", { usuario, tokenRestablecimiento });
    return res.status(400).json({ error: "Token inválido o expirado" });
  }

  // Actualizar contraseña en base de datos
  const consultaActualizar = "UPDATE usuarios SET password = ? WHERE username = ?";
  console.log("Consulta de actualización de contraseña:", consultaActualizar, "Valores:", [nuevaContraseña, usuario]);

  pool.query(consultaActualizar, [nuevaContraseña, usuario], (err, resultado) => {
    if (err) {
      console.log("Error al actualizar la contraseña:", err);
      return res.status(500).json({ error: "Error al actualizar la contraseña" });
    }

    // Eliminar el token de restablecimiento utilizado
    delete tokensRestablecimiento[usuario];
    console.log("Token eliminado:", usuario);

    res.json({ mensaje: "Contraseña restablecida exitosamente" });
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  // console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
