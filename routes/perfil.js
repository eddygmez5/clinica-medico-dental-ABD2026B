const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verificarSesion = require('../middleware/verificarSesion');

// 1. MOSTRAR EL FORMULARIO DE PERFIL (GET /perfil)
router.get('/', verificarSesion, async (req, res) => {
    const usuario = req.session.usuario;
    let datosPerfil = null;

    try {
        // Buscamos si ya tiene perfil llenado según su rol
        if (usuario.rol === 'Medico') {
            const [medicos] = await db.query('SELECT * FROM Medico WHERE fk_usuario = ?', [usuario.id]);
            if (medicos.length > 0) datosPerfil = medicos[0];
        } else {
            const [recepcionistas] = await db.query('SELECT * FROM Recepcionista WHERE fk_usuario = ?', [usuario.id]);
            if (recepcionistas.length > 0) datosPerfil = recepcionistas[0];
        }

        // También traemos su correo desde la tabla Usuario
        const [userRow] = await db.query('SELECT email FROM Usuario WHERE pk_usuario = ?', [usuario.id]);
        const emailUsuario = userRow[0].email;

        res.render('perfil', {
            usuario,
            perfil: datosPerfil,
            emailUsuario,
            mensaje: req.query.guardado ? 'Perfil actualizado correctamente.' : null
        });

    } catch (error) {
        console.error('Error cargando perfil:', error);
        res.send('Error al cargar el perfil.');
    }
});

// 2. GUARDAR O ACTUALIZAR EL PERFIL (POST /perfil)
router.post('/', verificarSesion, async (req, res) => {
    const usuario = req.session.usuario;
    const { nombre, apellido, fecha_nacimiento, sexo, telefono, email, especialidad } = req.body;

    try {
        if (usuario.rol === 'Medico') {
            // Revisamos si ya existe su registro en Medico
            const [existe] = await db.query('SELECT pk_medico FROM Medico WHERE fk_usuario = ?', [usuario.id]);

            if (existe.length > 0) {
                // Si ya existe, actualizamos (UPDATE)
                await db.query(
                    `UPDATE Medico SET nombre = ?, apellido = ?, fecha_nacimiento = ?, sexo = ?, telefono = ?, email = ?, especialidad = ? 
                     WHERE fk_usuario = ?`,
                    [nombre, apellido, fecha_nacimiento || null, sexo, telefono, email, especialidad, usuario.id]
                );
            } else {
                // Si es la primera vez, insertamos (INSERT)
                await db.query(
                    `INSERT INTO Medico (fk_usuario, nombre, apellido, fecha_nacimiento, sexo, telefono, email, especialidad) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [usuario.id, nombre, apellido, fecha_nacimiento || null, sexo, telefono, email, especialidad]
                );
            }
        } else {
            // Lógica para Recepcionista
            const [existe] = await db.query('SELECT pk_recepcionista FROM Recepcionista WHERE fk_usuario = ?', [usuario.id]);

            if (existe.length > 0) {
                await db.query(
                    `UPDATE Recepcionista SET nombre = ?, apellido = ?, sexo = ?, telefono = ?, email = ? 
                     WHERE fk_usuario = ?`,
                    [nombre, apellido, sexo, telefono, email, usuario.id]
                );
            } else {
                await db.query(
                    `INSERT INTO Recepcionista (fk_usuario, nombre, apellido, sexo, telefono, email) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [usuario.id, nombre, apellido, sexo, telefono, email]
                );
            }
        }

        res.redirect('/perfil?guardado=1');

    } catch (error) {
        console.error('Error guardando perfil:', error);
        res.send('Error al guardar los datos del perfil: ' + error.message);
    }
});

module.exports = router;