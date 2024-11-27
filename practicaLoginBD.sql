CREATE DATABASE practica_login;

USE practica_login;

-- La tabla de usuarios se compone de 3 columnas: username, email y password, el email es la clave primaria
CREATE TABLE usuarios (
    username VARCHAR(50) NOT NULL,
    email VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    token VARCHAR(48) NOT NULL
);