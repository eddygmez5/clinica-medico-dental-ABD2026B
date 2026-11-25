-- =========================================
-- Base de datos: Clinica Medico-Dental
-- =========================================

CREATE DATABASE IF NOT EXISTS medico_dental;
USE medico_dental;

CREATE TABLE Usuario (
    pk_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre_usuario VARCHAR(30) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    rol ENUM('Medico','Recepcionista') NOT NULL,
    -- Campos para confirmar registro y recuperar contraseña por correo
    codigo_activacion VARCHAR(64) DEFAULT NULL,
    estado_activacion TINYINT(1) NOT NULL DEFAULT 0, -- 0 = pendiente de correo, 1 = activo
    token_recuperacion VARCHAR(64) DEFAULT NULL,
    token_expiracion DATETIME DEFAULT NULL
);

CREATE TABLE Sesion (
    pk_sesion INT AUTO_INCREMENT PRIMARY KEY,
    fk_usuario INT NOT NULL,
    login DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout DATETIME DEFAULT NULL,
    duration TIME DEFAULT NULL,
    ip VARCHAR(50) NOT NULL,
    useragent TEXT NOT NULL,
    FOREIGN KEY (fk_usuario) REFERENCES Usuario(pk_usuario)
);

CREATE TABLE Medico (
    pk_medico INT AUTO_INCREMENT PRIMARY KEY,
    fk_usuario INT NOT NULL UNIQUE,
    nombre VARCHAR(30) NOT NULL,
    apellido VARCHAR(30) NOT NULL,
    fecha_nacimiento DATE,
    sexo ENUM('Masculino','Femenino'),
    telefono VARCHAR(30),
    email VARCHAR(40),
    especialidad ENUM(
        'medicina_general','odontologia_general','ortodoncia',
        'endodoncia','periodoncia','pediatria','ginecologia'
    ) NOT NULL,
    FOREIGN KEY (fk_usuario) REFERENCES Usuario(pk_usuario)
);

CREATE TABLE Horario_medico (
    pk_horario_medico INT AUTO_INCREMENT PRIMARY KEY,
    fk_medico INT NOT NULL,
    dia_semana ENUM('Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo') NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    FOREIGN KEY (fk_medico) REFERENCES Medico(pk_medico)
);

CREATE TABLE Recepcionista (
    pk_recepcionista INT AUTO_INCREMENT PRIMARY KEY,
    fk_usuario INT NOT NULL UNIQUE,
    nombre VARCHAR(30) NOT NULL,
    apellido VARCHAR(30) NOT NULL,
    sexo ENUM('Masculino','Femenino'),
    telefono VARCHAR(30),
    email VARCHAR(40),
    FOREIGN KEY (fk_usuario) REFERENCES Usuario(pk_usuario)
);

CREATE TABLE Paciente (
    pk_paciente INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL,
    apellido VARCHAR(30) NOT NULL,
    fecha_nacimiento DATE,
    sexo ENUM('Masculino','Femenino'),
    telefono VARCHAR(30),
    email VARCHAR(40),
    direccion VARCHAR(60),
    contacto_emergencia VARCHAR(60)
);

CREATE TABLE Enfermedad (
    pk_enfermedad INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL
);

CREATE TABLE Alergia (
    pk_alergia INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL
);

CREATE TABLE Cita (
    pk_cita INT AUTO_INCREMENT PRIMARY KEY,
    fk_paciente INT NOT NULL,
    fk_medico INT NOT NULL,
    fk_enfermedad INT,
    fecha DATE NOT NULL,
    motivo_consulta VARCHAR(150),
    notas VARCHAR(150),
    costo_total DECIMAL(10,2),
    estado ENUM('agendada','atendida','cancelada') NOT NULL DEFAULT 'agendada',
    FOREIGN KEY (fk_paciente) REFERENCES Paciente(pk_paciente),
    FOREIGN KEY (fk_medico) REFERENCES Medico(pk_medico),
    FOREIGN KEY (fk_enfermedad) REFERENCES Enfermedad(pk_enfermedad)
);

CREATE TABLE Paciente_enfermedad (
    pk_fk_paciente INT NOT NULL,
    pk_fk_enfermedad INT NOT NULL,
    es_cronica BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (pk_fk_paciente, pk_fk_enfermedad),
    FOREIGN KEY (pk_fk_paciente) REFERENCES Paciente(pk_paciente),
    FOREIGN KEY (pk_fk_enfermedad) REFERENCES Enfermedad(pk_enfermedad)
);

CREATE TABLE Paciente_alergia (
    pk_fk_paciente INT NOT NULL,
    pk_fk_alergia INT NOT NULL,
    gravedad ENUM('leve','moderada','severa') NOT NULL,
    PRIMARY KEY (pk_fk_paciente, pk_fk_alergia),
    FOREIGN KEY (pk_fk_paciente) REFERENCES Paciente(pk_paciente),
    FOREIGN KEY (pk_fk_alergia) REFERENCES Alergia(pk_alergia)
);