CREATE DATABASE practica_login;

USE practica_login;

-- La tabla de usuarios se compone de 3 columnas: username, email y password
CREATE TABLE usuarios (
    username VARCHAR(50) PRIMARY KEY,
    email VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- La tabla de tokens de restablecimiento se compone de 3 columnas: username, token y creado_en
CREATE TABLE tokens_restablecimiento (
    username VARCHAR(50) NOT NULL,
    token VARCHAR(255) NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (username) REFERENCES usuarios(username),
    PRIMARY KEY (username, token)
);

-- Se insertan 3 usuarios de prueba
INSERT INTO usuarios (username, email, password)
VALUES ('usuario1', 'correo1@gmail.com', '470ea79e04621c2e126e3a0a560bb1d94878809e7b7df20aa04f1662ecddf102'),
       ('usuario2', 'correo2@gmail.com', '470ea79e04621c2e126e3a0a560bb1d94878809e7b7df20aa04f1662ecddf102'),
       ('usuario3', 'correo3@gmail.com', '470ea79e04621c2e126e3a0a560bb1d94878809e7b7df20aa04f1662ecddf102');
