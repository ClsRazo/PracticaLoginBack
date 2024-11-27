const express = require("express"); // Se instala con npm install express
const cors = require("cors"); // Se instala con npm install cors
const bodyParser = require("body-parser"); // Se instala con npm install body-parser
const mysql = require("mysql2"); // Se instala con npm install mysql2
//Para los JWT
const jwt = require("jsonwebtoken"); // Se instala con npm install jsonwebtoken
require("dotenv").config(); // Se instala con npm install dotenv
const crypto = require('crypto');
const nodemailer = require('nodemailer'); // Instalar con npm install nodemailer

const app = express();
const PORT = 5000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Configuración para la BD
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "practica_login",
});

// Conexión a la BD
db.connect((err) => {
  if (err) {
    console.error("Error de conexión: " + err.stack);
    return;
  }
  console.log("Conexión exitosa a la BD");
});

// Almacenamiento TEMPORAL EH de tokens de restablecimiento (usar base de datos)
const tokensRestablecimiento = {};

// Transporte de Nodemailer (usar configuración de servicio de correo)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
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
  db.query(query, [username], (err, result) => {
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

  db.query(query, [username], (err, results) => {
    if (err) {
      return res.status(500).json({error: "Error en la consulta"});
    }

    if (results.length > 0) {
      return res.status(400).json({error: "El usuario ya existe"});
    }

    //Creamos el nuevo usuario
    const insertQuery = "INSERT INTO usuarios (username, email, password) VALUES (?, ?, ?)";
    db.query(insertQuery, [username, email, password], (err, result) => {
      if (err) {
        return res.status(500).json({error: "Error al registrar el usuario"});
      }
      res.status(201).json({message: "Usuario registrado correctamente"});
    });
  });
});

// ------------------------------Para solicitar restablecimiento de contraseña------------------------------
app.post('/solicitar-restablecimiento', (req, res) => {
  const { username } = req.body;
  
  console.log("Solicitud de restablecimiento recibida para usuario:", username);

  // Verificar si el usuario existe y obtener su correo
  const consulta = "SELECT email FROM usuarios WHERE username = ?";
  
  db.query(consulta, [username], (err, resultados) => {
    if (err) {
      console.log("Error en la consulta:", err);
      return res.status(500).json({ error: "Error en la consulta" });
    }

    if (resultados.length === 0) {
      console.log("Usuario no encontrado:", username);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const email = resultados[0].email;

    // Generar token de restablecimiento
    const tokenRestablecimiento = crypto.randomBytes(6).toString('hex');
    console.log("Token generado:", tokenRestablecimiento);
    
    // Almacenar token en la base de datos
    const insertarToken = "INSERT INTO tokens_restablecimiento (email, token, username) VALUES (?, ?, ?)";
    
    db.query(insertarToken, [email, tokenRestablecimiento, username], (err) => {
      if (err) {
        console.log("Error al guardar token:", err);
        return res.status(500).json({ error: "Error al generar token" });
      }

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
        
        console.log("Correo enviado con éxito");
        res.json({ mensaje: "Código de restablecimiento enviado" });
      });
    });
  });
});

// ------------------------------Para verificar token de restablecimiento------------------------------
app.post('/verificar-token-restablecimiento', (req, res) => {
  const { username, tokenRestablecimiento } = req.body;
  
  console.log("Verificación de token recibida:", { username, tokenRestablecimiento });

  // Primero, obtener el email asociado al username
  const consultaEmail = "SELECT email FROM usuarios WHERE username = ?";
  
  db.query(consultaEmail, [username], (errEmail, resultadosEmail) => {
    if (errEmail || resultadosEmail.length === 0) {
      console.log("Error al obtener email:", errEmail);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const email = resultadosEmail[0].email;

    const consultaToken = `
      SELECT * FROM tokens_restablecimiento 
      WHERE email = ? AND token = ? 
      AND username = ?
      AND TIMESTAMPDIFF(MINUTE, creado_en, NOW()) <= 15
    `;

    db.query(consultaToken, [email, tokenRestablecimiento, username], (err, resultados) => {
      if (err) {
        console.log("Error al verificar token:", err);
        return res.status(500).json({ error: "Error al verificar token" });
      }

      if (resultados.length === 0) {
        console.log("Token inválido o expirado");
        return res.status(400).json({ error: "Token inválido o expirado" });
      }

      console.log("Token verificado correctamente");
      res.json({ mensaje: "Token verificado correctamente" });
    });
  });
});

// ------------------------------Para restablecer contraseña------------------------------
app.post('/restablecer-contrasena', (req, res) => {
  const { username, tokenRestablecimiento, nuevaContraseña } = req.body;
  
  console.log("Solicitud de restablecimiento de contraseña:", { username, tokenRestablecimiento });

  // Primero, obtener el email asociado al username
  const consultaEmail = "SELECT email FROM usuarios WHERE username = ?";
  
  db.query(consultaEmail, [username], (errEmail, resultadosEmail) => {
    if (errEmail || resultadosEmail.length === 0) {
      console.log("Error al obtener email:", errEmail);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const email = resultadosEmail[0].email;

    const consultaToken = `
      SELECT * FROM tokens_restablecimiento 
      WHERE email = ? AND token = ? 
      AND username = ?
      AND TIMESTAMPDIFF(MINUTE, creado_en, NOW()) <= 15
    `;

    db.query(consultaToken, [email, tokenRestablecimiento, username], (err, resultados) => {
      if (err) {
        console.log("Error al verificar token:", err);
        return res.status(500).json({ error: "Error al verificar token" });
      }

      if (resultados.length === 0) {
        console.log("Token inválido o expirado");
        return res.status(400).json({ error: "Token inválido o expirado" });
      }

      // Actualizar contraseña en base de datos
      const consultaActualizar = "UPDATE usuarios SET password = ? WHERE username = ?";

      db.query(consultaActualizar, [nuevaContraseña, username], (err) => {
        if (err) {
          console.log("Error al actualizar la contraseña:", err);
          return res.status(500).json({ error: "Error al actualizar la contraseña" });
        }

        // Eliminar token utilizado
        const eliminarToken = "DELETE FROM tokens_restablecimiento WHERE email = ? AND token = ?";
        db.query(eliminarToken, [email, tokenRestablecimiento]);

        res.json({ mensaje: "Contraseña restablecida exitosamente" });
      });
    });
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
