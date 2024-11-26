const express = require("express"); //Se instala con npm install express
const cors = require("cors"); //Se instala con npm install cors
const bodyParser = require("body-parser"); //Se instala con npm install body-parser
const mysql = require("mysql2"); //Se instala con npm install mysql2
//Para los JWT
const jwt = require("jsonwebtoken"); //Se instala con npm install jsonwebtoken
require("dotenv").config(); //Se instala con npm install dotenv

const app = express();
const PORT = 5000;

//Middlewares
app.use(cors());
app.use(bodyParser.json());

//Configuración para la BD
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "280103Ac+",
  database: "practica_login",
});

//Conexión a la BD
db.connect((err) => {
  if (err) {
    console.error("Error de conexión: " + err.stack);
    return;
  }
  console.log("Conexión exitosa a la BD");
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

//------------------------------Iniciar el servidor------------------------------
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});