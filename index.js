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
  const query = "SELECT * FROM usuarios where username = $1";
  //db. se usa para MySQL, para PostgreSQL se usa pool.
  pool.query(query, [username], (err, result) => {
    if (err) {
      console.error("Error en la consulta: " + err.stack);
      return res.status(500).json({error: "Error en la consulta login"});
    }

    //Si no hay resultados
    if (result.rows.length === 0) {
      return res.status(401).json({error: "Usuario no encontrado"});
    }

    //¿Puede ser que haya más de un usuario con el mismo nombre?
    //Si no, entonces solo habrá un resultado
    const usuario = result.rows[0];
    if (usuario.password === password) {
      //Generamos el token y lo enviamos
      const token = jwt.sign({email: usuario.email, username: usuario.username}, process.env.JWT_SECRET, {expiresIn: "1h"});
      return res.json({message: "Login exitoso", token});
    } else {
      return res.status(401).json({error: "Contraseña incorrecta"});
    }
  });
});

//------------------------------Para la verificación------------------------------
app.post("/verificacion", (req, res) => {
  const {email} = req.body;

  // Generar token de restablecimiento
  const tokenRestablecimiento = crypto.randomBytes(6).toString('hex');
  console.log("Token generado:", tokenRestablecimiento);

  //Mandamos el correo con el token
  const opcionesCorreo = {
    from: process.env.CORREO_USUARIO,
    to: email,
    subject: 'Verificación de Correo',
    html: `
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #e7d9ff;
              margin: 0;
              padding: 0;
              color: #200232;
            }
            .container {
              width: 100%;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              border: 2px solid #200232;
              box-sizing: border-box;
            }
            .header {
              text-align: center;
              background-color: #200232;
              color: #e7d9ff;
              padding: 15px;
            }
            .header img {
              width: 100px; /* Puedes ajustar el tamaño aquí */
              height: auto;
              margin-bottom: 10px; /* Espacio debajo del logo */
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: bold;
              color: #e7d9ff;
            }
            .content {
              padding: 20px;
              text-align: center;
            }
            .content p {
              font-size: 16px;
              line-height: 1.6;
              margin: 15px 0;
            }
            .code {
              display: inline-block;
              background-color: #200232;
              color: #e7d9ff;
              font-size: 24px;
              font-weight: bold;
              padding: 10px 20px;
              margin: 20px 0;
              letter-spacing: 2px;
            }
            .button {
              display: inline-block;
              background-color: #e7d9ff;
              color: #200232;
              padding: 12px 24px;
              font-size: 16px;
              text-decoration: none;
              margin-top: 20px;
              border: 2px solid #200232;
              transition: background-color 0.3s ease;
            }
            .button:hover {
              background-color: #e7d9ff;
              color: #200232;
              border: 2px solid #200232;
            }
            .footer {
              text-align: center;
              font-size: 12px;
              padding: 20px;
              border-top: 1px solid #200232;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="cid:logo" alt="Logo RegiSecure">
              <h1>Verificación de Correo</h1>
            </div>
            <div class="content">
              <p>Hola,</p>
              <p>Gracias por registrarte en nuestra plataforma. Para verificar tu correo, por favor ingresa en la ventana correspondiente el siguiente código:</p>
              <div class="code">${tokenRestablecimiento}</div>
              <p>Este código expirará en 15 minutos.</p>
              <p>Si no has solicitado la verificación de tu correo, por favor ignora este mensaje.</p>
            </div>
            <div class="footer">
              <p>Si no has solicitado la verificación de tu correo, puedes ignorar este mensaje.</p>
              <p>&copy; 2024 RegiSecure. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    attachments: [
      {
        filename: 'LogoCentro.png',
        path: 'img/LogoCentro.png',
        cid: 'logo'
      }]

  };

  transporter.sendMail(opcionesCorreo, (error, info) => {
    if (error) {
      console.log("Error al enviar el correo:", error);
      return res.status(500).json({error: "Error al enviar el correo"});
    }

    console.log("Correo enviado con éxito");
    res.status(200).json({message: "Correo enviado con éxito", token: tokenRestablecimiento, hora: new Date().toISOString(), expira: new Date(Date.now() + 15 * 60 * 1000).toISOString()});
    // res.json({token: tokenRestablecimiento, hora: new Date().toISOString(), expira: new Date(Date.now() + 15 * 60 * 1000).toISOString()}, email);
  });

});

//------------------------------Para el registro------------------------------
app.post("/register", (req, res) => {
  const {username, email, password} = req.body;

  //Comprobamos si el usuario ya existe
  const query = "SELECT * FROM usuarios WHERE username = $1";

  pool.query(query, [username], (err, results) => {
    if (err) {
      return res.status(500).json({error: "Error en la consulta"});
    }

    if (results.rows.length > 0) {
      return res.status(400).json({error: "El usuario ya existe"});
    }

    //Creamos el usuario en la BD
    const insertQuery = "INSERT INTO usuarios (username, email, password) VALUES ($1, $2, $3)";
    pool.query(insertQuery, [username, email, password], (err, result) => {
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
  const consulta = "SELECT email FROM usuarios WHERE username = $1";

  console.log("Consulta SQL:", consulta, "Valores:", [username]);

  pool.query(consulta, [username], (err, resultados) => {
    if (err) {
      console.log("Error en la consulta:", err);
      return res.status(500).json({ error: "Error en la consulta" });
    }

    if (resultados.rows.length === 0) {
      console.log("Usuario no encontrado:", username);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const email = resultados.rows[0].email;

    // Generar token de restablecimiento
    const tokenRestablecimiento = crypto.randomBytes(6).toString('hex');
    console.log("Token generado:", tokenRestablecimiento);
    
    // Almacenar token en la base de datos
    const insertarToken = "INSERT INTO tokens_restablecimiento (email, token, username) VALUES ($1, $2, $3)";
    
    pool.query(insertarToken, [email, tokenRestablecimiento, username], (err) => {
      if (err) {
        console.log("Error al guardar token:", err);
        return res.status(500).json({ error: "Error al generar token" });
      }

      // Enviar correo
      const opcionesCorreo = {
        from: process.env.CORREO_USUARIO,
        to: email,
        subject: 'Restablecimiento de Contraseña',
        html: `
          <html>
            <head>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  background-color: #e7d9ff;
                  margin: 0;
                  padding: 0;
                  color: #200232;
                }
                .container {
                  width: 100%;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                  border: 2px solid #200232;
                  box-sizing: border-box;
                }
                .header {
                  text-align: center;
                  background-color: #200232;
                  color: #e7d9ff;
                  padding: 15px;
                }
                .header img {
                  width: 100px; /* Puedes ajustar el tamaño aquí */
                  height: auto;
                  margin-bottom: 10px; /* Espacio debajo del logo */
                }
                .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: bold;
                  color: #e7d9ff;
                }
                .content {
                  padding: 20px;
                  text-align: center;
                }
                .content p {
                  font-size: 16px;
                  line-height: 1.6;
                  margin: 15px 0;
                }
                .code {
                  display: inline-block;
                  background-color: #200232;
                  color: #e7d9ff;
                  font-size: 24px;
                  font-weight: bold;
                  padding: 10px 20px;
                  margin: 20px 0;
                  letter-spacing: 2px;
                }
                .button {
                  display: inline-block;
                  background-color: #e7d9ff;
                  color: #200232;
                  padding: 12px 24px;
                  font-size: 16px;
                  text-decoration: none;
                  margin-top: 20px;
                  border: 2px solid #200232;
                  transition: background-color 0.3s ease;
                }
                .button:hover {
                  background-color: #e7d9ff;
                  color: #200232;
                  border: 2px solid #200232;
                }
                .footer {
                  text-align: center;
                  font-size: 12px;
                  padding: 20px;
                  border-top: 1px solid #200232;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <img src="cid:logo" alt="Logo RegiSecure">
                  <h1>Restablecimiento de Contraseña</h1>
                </div>
                <div class="content">
                  <p>Hola,</p>
                  <p>Hemos recibido una solicitud para restablecer tu contraseña. Si no solicitaste este cambio, por favor ignora este correo.</p>
                  <p>Tu código de restablecimiento de contraseña es:</p>
                  <div class="code">${tokenRestablecimiento}</div>
                  <p>Este código expirará en 15 minutos.</p>
                  <p>Si no puedes restablecer tu contraseña o tienes alguna duda, por favor, contacta con nuestro soporte.</p>
                </div>
                <div class="footer">
                  <p>Si no has solicitado el restablecimiento de tu contraseña, puedes ignorar este mensaje.</p>
                  <p>&copy; 2024 RegiSecure. Todos los derechos reservados.</p>
                </div>
              </div>
            </body>
          </html>
        `,
        attachments: [
          {
            filename: 'LogoCentro.png',
            path: 'img/LogoCentro.png',
            cid: 'logo'
          }]
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
  const consultaEmail = "SELECT email FROM usuarios WHERE username = $1";
  
  pool.query(consultaEmail, [username], (errEmail, resultadosEmail) => {
    if (errEmail || resultadosEmail.rows.length === 0) {
      console.log("Error al obtener email:", errEmail);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const email = resultadosEmail.rows[0].email;

    // const consultaToken = `
    //   SELECT * FROM tokens_restablecimiento 
    //   WHERE email = $1 AND token = $2 
    //   AND username = $3
    //   AND TIMESTAMPDIFF(MINUTE, creado_en, NOW()) <= 15
    // `;

    const consultaToken = `SELECT * FROM tokens_restablecimiento
    WHERE email = $1 AND token = $2 AND username = $3
    AND EXTRACT(EPOCH FROM NOW() - creado_en) / 60 <= 15`;

    pool.query(consultaToken, [email, tokenRestablecimiento, username], (err, resultados) => {
      if (err) {
        console.log("Error al verificar token:", err);
        return res.status(500).json({ error: "Error al verificar token" });
      }

      if (resultados.rows.length === 0) {
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
  const consultaEmail = "SELECT email FROM usuarios WHERE username = $1";
  
  pool.query(consultaEmail, [username], (errEmail, resultadosEmail) => {
    if (errEmail || resultadosEmail.rows.length === 0) {
      console.log("Error al obtener email:", errEmail);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const email = resultadosEmail.rows[0].email;

    const consultaToken = `SELECT * FROM tokens_restablecimiento
    WHERE email = $1 AND token = $2 AND username = $3
    AND EXTRACT(EPOCH FROM NOW() - creado_en) / 60 <= 15`;

    pool.query(consultaToken, [email, tokenRestablecimiento, username], (err, resultados) => {
      if (err) {
        console.log("Error al verificar token:", err);
        return res.status(500).json({ error: "Error al verificar token" });
      }

      if (resultados.rows.length === 0) {
        console.log("Token inválido o expirado");
        return res.status(400).json({ error: "Token inválido o expirado" });
      }
      // Actualizar contraseña en base de datos
      const consultaActualizar = "UPDATE usuarios SET password = $1 WHERE username = $2";
      console.log("Consulta de actualización de contraseña:", consultaActualizar, "Valores:", [nuevaContraseña, username]);

      pool.query(consultaActualizar, [nuevaContraseña, username], (err, resultado) => {
        if (err) {
          console.log("Error al actualizar la contraseña:", err);
          return res.status(500).json({ error: "Error al actualizar la contraseña" });
        }

          // Actualizar contraseña en base de datos
          const consultaActualizar = "UPDATE usuarios SET password = $1 WHERE username = $2";

          pool.query(consultaActualizar, [nuevaContraseña, username], (err) => {
            if (err) {
              console.log("Error al actualizar la contraseña:", err);
              return res.status(500).json({ error: "Error al actualizar la contraseña" });
            }

            // Eliminar token utilizado
            const eliminarToken = "DELETE FROM tokens_restablecimiento WHERE email = $1 AND token = $2";
            pool.query(eliminarToken, [email, tokenRestablecimiento]);

            res.json({ mensaje: "Contraseña restablecida exitosamente" });
          });
        });
      });
  });
});


// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en https://practicaloginback.onrender.com`);
});
