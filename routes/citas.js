const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verificarSesion = require('../middleware/verificarSesion');

// 1. VER AGENDA DE CITAS (GET /citas)
router.get('/', verificarSesion, async (req, res) => {
    const usuario = req.session.usuario;

    try {
        let query = `
            SELECT 
                c.pk_cita,
                c.fecha,
                c.motivo_consulta,
                c.costo_total,
                c.estado,
                c.notas,
                CONCAT(p.nombre, ' ', p.apellido) AS paciente_nombre,
                p.telefono AS paciente_telefono,
                CONCAT(m.nombre, ' ', m.apellido) AS medico_nombre,
                m.especialidad
            FROM Cita c
            INNER JOIN Paciente p ON c.fk_paciente = p.pk_paciente
            INNER JOIN Medico m ON c.fk_medico = m.pk_medico
        `;
        let params = [];

        // Si es Médico, filtramos para que solo vea SUS propias consultas
        if (usuario.rol === 'Medico') {
            query += ' WHERE m.fk_usuario = ?';
            params.push(usuario.id);
        }

        query += ' ORDER BY c.fecha DESC, c.pk_cita DESC';

        const [citas] = await db.query(query, params);

        res.render('citas/agenda', {
            usuario,
            citas,
            mensaje: req.query.exito || null
        });
    } catch (error) {
        console.error('Error al cargar agenda:', error);
        res.send('Error al cargar la agenda de citas: ' + error.message);
    }
});

// 2. MOSTRAR FORMULARIO PARA AGENDAR (EXCLUSIVO RECEPCIONISTA)
router.get('/agendar', verificarSesion, async (req, res) => {
    if (req.session.usuario.rol !== 'Recepcionista') {
        return res.redirect('/citas');
    }

    try {
        const [pacientes] = await db.query('SELECT pk_paciente, nombre, apellido FROM Paciente ORDER BY nombre ASC');
        const [medicos] = await db.query('SELECT pk_medico, nombre, apellido, especialidad FROM Medico ORDER BY nombre ASC');

        res.render('citas/agendar', {
            usuario: req.session.usuario,
            pacientes,
            medicos,
            error: null
        });
    } catch (error) {
        console.error('Error al cargar formulario de cita:', error);
        res.send('Error al cargar datos para agendar: ' + error.message);
    }
});

// 3. GUARDAR NUEVA CITA (EXCLUSIVO RECEPCIONISTA)
router.post('/agendar', verificarSesion, async (req, res) => {
    if (req.session.usuario.rol !== 'Recepcionista') {
        return res.redirect('/citas');
    }

    const { fk_paciente, fk_medico, fecha, motivo_consulta, costo_total } = req.body;

    try {
        await db.query(
            `INSERT INTO Cita (fk_paciente, fk_medico, fecha, motivo_consulta, costo_total, estado) 
             VALUES (?, ?, ?, ?, ?, 'agendada')`,
            [fk_paciente, fk_medico, fecha, motivo_consulta, costo_total || 0]
        );

        res.redirect('/citas?exito=Cita+agendada+correctamente');
    } catch (error) {
        console.error('Error al guardar cita:', error);
        res.send('Error al guardar la cita: ' + error.message);
    }
});

// 4. ACTUALIZAR ESTADO Y NOTAS DE LA CITA (POST /citas/actualizar/:id)
router.post('/actualizar/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { estado, notas } = req.body;

    try {
        await db.query(
            'UPDATE Cita SET estado = ?, notas = ? WHERE pk_cita = ?',
            [estado, notas, id]
        );

        res.redirect('/citas?exito=Cita+actualizada+correctamente');
    } catch (error) {
        console.error('Error al actualizar cita:', error);
        res.send('Error al actualizar la cita: ' + error.message);
    }
});

module.exports = router;