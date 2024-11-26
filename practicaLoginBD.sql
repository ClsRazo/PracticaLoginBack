CREATE DATABASE practica_login;

USE practica_login;

-- La tabla de usuarios se compone de 3 columnas: username, email y password, el email es la clave primaria
CREATE TABLE usuarios (
    username VARCHAR(50) NOT NULL,
    email VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255) NOT NULL
);

-- Se insertan 3 usuarios de prueba
INSERT INTO usuarios (username, email, password)
VALUES ('usuario1', 'correo1@gmail.com', '470ea79e04621c2e126e3a0a560bb1d94878809e7b7df20aa04f1662ecddf102'),
       ('usuario2', 'correo2@gmail.com', '470ea79e04621c2e126e3a0a560bb1d94878809e7b7df20aa04f1662ecddf102'),
       ('usuario3', 'correo3@gmail.com', '470ea79e04621c2e126e3a0a560bb1d94878809e7b7df20aa04f1662ecddf102');