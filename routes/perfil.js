const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verificarSesion = require('../middleware/verificarSesion');

// 1. MOSTRAR EL FORMULARIO DE PERFIL Y HORARIOS (GET /perfil)
router.get('/', verificarSesion, async (req, res) => {
    const usuario = req.session.usuario;
    let datosPerfil = null;
    let horarios = [];

    try {
        if (usuario.rol === 'Medico') {
            const [medicos] = await db.query('SELECT * FROM Medico WHERE fk_usuario = ?', [usuario.id]);
            if (medicos.length > 0) {
                datosPerfil = medicos[0];
                // Traemos los horarios registrados de este médico
                const [filasHorarios] = await db.query(
                    `SELECT * FROM Horario_medico 
                     WHERE fk_medico = ? 
                     ORDER BY FIELD(dia_semana, 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'), hora_inicio ASC`,
                    [datosPerfil.pk_medico]
                );
                horarios = filasHorarios;
            }
        } else {
            const [recepcionistas] = await db.query('SELECT * FROM Recepcionista WHERE fk_usuario = ?', [usuario.id]);
            if (recepcionistas.length > 0) datosPerfil = recepcionistas[0];
        }

        const [userRow] = await db.query('SELECT email FROM Usuario WHERE pk_usuario = ?', [usuario.id]);
        const emailUsuario = userRow[0].email;

        let mensaje = null;
        if (req.query.guardado) mensaje = 'Perfil actualizado correctamente.';
        if (req.query.horario_agregado) mensaje = 'Horario de atención agregado.';
        if (req.query.horario_eliminado) mensaje = 'Horario eliminado.';

        res.render('perfil', {
            usuario,
            perfil: datosPerfil,
            horarios,
            emailUsuario,
            mensaje
        });

    } catch (error) {
        console.error('Error cargando perfil:', error);
        res.send('Error al cargar el perfil.');
    }
});

// 2. GUARDAR O ACTUALIZAR DATOS PERSONALES DEL PERFIL (POST /perfil)
router.post('/', verificarSesion, async (req, res) => {
    const usuario = req.session.usuario;
    const { nombre, apellido, fecha_nacimiento, sexo, telefono, email, especialidad } = req.body;

    try {
        if (usuario.rol === 'Medico') {
            const [existe] = await db.query('SELECT pk_medico FROM Medico WHERE fk_usuario = ?', [usuario.id]);

            if (existe.length > 0) {
                await db.query(
                    `UPDATE Medico SET nombre = ?, apellido = ?, fecha_nacimiento = ?, sexo = ?, telefono = ?, email = ?, especialidad = ? 
                     WHERE fk_usuario = ?`,
                    [nombre, apellido, fecha_nacimiento || null, sexo, telefono, email, especialidad, usuario.id]
                );
            } else {
                await db.query(
                    `INSERT INTO Medico (fk_usuario, nombre, apellido, fecha_nacimiento, sexo, telefono, email, especialidad) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [usuario.id, nombre, apellido, fecha_nacimiento || null, sexo, telefono, email, especialidad]
                );
            }
        } else {
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

// 3. AGREGAR HORARIO DE ATENCIÓN (POST /perfil/horario)
router.post('/horario', verificarSesion, async (req, res) => {
    const usuario = req.session.usuario;
    const { dia_semana, hora_inicio, hora_fin } = req.body;

    try {
        const [medicos] = await db.query('SELECT pk_medico FROM Medico WHERE fk_usuario = ?', [usuario.id]);
        if (medicos.length === 0) {
            return res.send('Primero debes guardar tus datos personales de médico antes de agregar horarios.');
        }

        await db.query(
            'INSERT INTO Horario_medico (fk_medico, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)',
            [medicos[0].pk_medico, dia_semana, hora_inicio, hora_fin]
        );

        res.redirect('/perfil?horario_agregado=1');
    } catch (error) {
        console.error('Error agregando horario:', error);
        res.send('Error al guardar el horario: ' + error.message);
    }
});

// 4. ELIMINAR HORARIO DE ATENCIÓN (POST /perfil/horario/eliminar/:id)
router.post('/horario/eliminar/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM Horario_medico WHERE pk_horario_medico = ?', [id]);
        res.redirect('/perfil?horario_eliminado=1');
    } catch (error) {
        console.error('Error eliminando horario:', error);
        res.send('Error al eliminar el horario: ' + error.message);
    }
});

module.exports = router;