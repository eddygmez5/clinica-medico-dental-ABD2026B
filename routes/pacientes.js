const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verificarSesion = require('../middleware/verificarSesion');

// Protege todas las rutas de pacientes (solo usuarios con sesión iniciada)
router.use(verificarSesion);

// ==========================================
// 1. LISTAR PACIENTES Y CATÁLOGOS MÉDICOS
// ==========================================
router.get('/', async (req, res) => {
    try {
        const [pacientes] = await db.query('SELECT * FROM Paciente ORDER BY pk_paciente DESC');
        const [enfermedades] = await db.query('SELECT * FROM Enfermedad ORDER BY nombre ASC');
        const [alergias] = await db.query('SELECT * FROM Alergia ORDER BY nombre ASC');

        res.render('pacientes/lista', {
            usuario: req.session.usuario,
            pacientes,
            enfermedades,
            alergias,
            error: req.query.error || null,
            exito: req.query.exito || null
        });
    } catch (error) {
        console.error('Error al listar pacientes:', error);
        res.status(500).send('Error al cargar la lista de pacientes');
    }
});

// ==========================================
// 2. CREAR Y EDITAR PACIENTES
// ==========================================
router.get('/crear', (req, res) => {
    res.render('pacientes/crear', {
        usuario: req.session.usuario,
        paciente: null
    });
});

router.post('/crear', async (req, res) => {
    const {
        nombre,
        apellido,
        fecha_nacimiento,
        sexo,
        telefono,
        email,
        direccion,
        contacto_emergencia
    } = req.body;

    try {
        await db.query(
            `INSERT INTO Paciente 
            (nombre, apellido, fecha_nacimiento, sexo, telefono, email, direccion, contacto_emergencia) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nombre,
                apellido,
                fecha_nacimiento || null,
                sexo || null,
                telefono || null,
                email || null,
                direccion || null,
                contacto_emergencia || null
            ]
        );
        res.redirect('/pacientes?exito=Paciente registrado correctamente');
    } catch (error) {
        console.error('Error al crear paciente:', error);
        res.redirect('/pacientes?error=No se pudo registrar el paciente');
    }
});

router.get('/editar/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Paciente WHERE pk_paciente = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.redirect('/pacientes?error=Paciente no encontrado');
        }
        res.render('pacientes/crear', {
            usuario: req.session.usuario,
            paciente: rows[0]
        });
    } catch (error) {
        console.error('Error al cargar paciente para editar:', error);
        res.redirect('/pacientes?error=Error al cargar el paciente');
    }
});

router.post('/editar/:id', async (req, res) => {
    const {
        nombre,
        apellido,
        fecha_nacimiento,
        sexo,
        telefono,
        email,
        direccion,
        contacto_emergencia
    } = req.body;

    try {
        await db.query(
            `UPDATE Paciente 
            SET nombre = ?, apellido = ?, fecha_nacimiento = ?, sexo = ?, 
                telefono = ?, email = ?, direccion = ?, contacto_emergencia = ?
            WHERE pk_paciente = ?`,
            [
                nombre,
                apellido,
                fecha_nacimiento || null,
                sexo || null,
                telefono || null,
                email || null,
                direccion || null,
                contacto_emergencia || null,
                req.params.id
            ]
        );
        res.redirect('/pacientes?exito=Datos del paciente actualizados');
    } catch (error) {
        console.error('Error al actualizar paciente:', error);
        res.redirect('/pacientes?error=No se pudo actualizar el paciente');
    }
});

// ==========================================
// 3. CATÁLOGOS: ENFERMEDADES Y ALERGIAS
// ==========================================
router.post('/catalogos/enfermedad', async (req, res) => {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) {
        return res.redirect('/pacientes?error=Escribe el nombre de la enfermedad');
    }
    try {
        await db.query('INSERT INTO Enfermedad (nombre) VALUES (?)', [nombre.trim()]);
        res.redirect('/pacientes?exito=Enfermedad agregada al catálogo');
    } catch (error) {
        console.error('Error al agregar enfermedad:', error);
        res.redirect('/pacientes?error=No se pudo agregar la enfermedad');
    }
});

router.post('/catalogos/alergia', async (req, res) => {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) {
        return res.redirect('/pacientes?error=Escribe el nombre de la alergia');
    }
    try {
        await db.query('INSERT INTO Alergia (nombre) VALUES (?)', [nombre.trim()]);
        res.redirect('/pacientes?exito=Alergia agregada al catálogo');
    } catch (error) {
        console.error('Error al agregar alergia:', error);
        res.redirect('/pacientes?error=No se pudo agregar la alergia');
    }
});

// ==========================================
// 4. EXPEDIENTE CLÍNICO DEL PACIENTE
// ==========================================
router.get('/expediente/:id', async (req, res) => {
    const idPaciente = req.params.id;
    try {
        const [pacientes] = await db.query('SELECT * FROM Paciente WHERE pk_paciente = ?', [idPaciente]);
        if (pacientes.length === 0) {
            return res.redirect('/pacientes?error=Paciente no encontrado');
        }

        const [enfermedadesPaciente] = await db.query(
            `SELECT e.pk_enfermedad, e.nombre, pe.es_cronica
             FROM Paciente_enfermedad pe
             JOIN Enfermedad e ON pe.pk_fk_enfermedad = e.pk_enfermedad
             WHERE pe.pk_fk_paciente = ?`,
            [idPaciente]
        );

        const [alergiasPaciente] = await db.query(
            `SELECT a.pk_alergia, a.nombre, pa.gravedad
             FROM Paciente_alergia pa
             JOIN Alergia a ON pa.pk_fk_alergia = a.pk_alergia
             WHERE pa.pk_fk_paciente = ?`,
            [idPaciente]
        );

        const [catalogoEnfermedades] = await db.query('SELECT * FROM Enfermedad ORDER BY nombre ASC');
        const [catalogoAlergias] = await db.query('SELECT * FROM Alergia ORDER BY nombre ASC');

        res.render('pacientes/expediente', {
            usuario: req.session.usuario,
            paciente: pacientes[0],
            enfermedadesPaciente,
            alergiasPaciente,
            catalogoEnfermedades,
            catalogoAlergias
        });
    } catch (error) {
        console.error('Error al cargar expediente:', error);
        res.redirect('/pacientes?error=Error al abrir el expediente');
    }
});

// Asignar enfermedad al paciente
router.post('/expediente/:id/enfermedad', async (req, res) => {
    const idPaciente = req.params.id;
    const { fk_enfermedad, es_cronica } = req.body;
    const cronica = es_cronica === 'on' ? 1 : 0;

    try {
        await db.query(
            `INSERT INTO Paciente_enfermedad (pk_fk_paciente, pk_fk_enfermedad, es_cronica)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE es_cronica = VALUES(es_cronica)`,
            [idPaciente, fk_enfermedad, cronica]
        );
        res.redirect(`/pacientes/expediente/${idPaciente}`); } catch (error) { console.error('Error al asignar enfermedad:', error); res.redirect(`/pacientes/expediente/${idPaciente}`);
    }
});

// Quitar enfermedad del paciente
router.post('/expediente/:id/enfermedad/:idEnfermedad/eliminar', async (req, res) => {
    const { id, idEnfermedad } = req.params;
    try {
        await db.query(
            'DELETE FROM Paciente_enfermedad WHERE pk_fk_paciente = ? AND pk_fk_enfermedad = ?',
            [id, idEnfermedad]
        );
        res.redirect(`/pacientes/expediente/${id}`); } catch (error) { console.error('Error al quitar enfermedad:', error); res.redirect(`/pacientes/expediente/${id}`);
    }
});

// Asignar alergia al paciente
router.post('/expediente/:id/alergia', async (req, res) => {
    const idPaciente = req.params.id;
    const { fk_alergia, gravedad } = req.body;

    try {
        await db.query(
            `INSERT INTO Paciente_alergia (pk_fk_paciente, pk_fk_alergia, gravedad)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE gravedad = VALUES(gravedad)`,
            [idPaciente, fk_alergia, gravedad]
        );
        res.redirect(`/pacientes/expediente/${idPaciente}`); } catch (error) { console.error('Error al asignar alergia:', error); res.redirect(`/pacientes/expediente/${idPaciente}`);
    }
});

// Quitar alergia del paciente
router.post('/expediente/:id/alergia/:idAlergia/eliminar', async (req, res) => {
    const { id, idAlergia } = req.params;
    try {
        await db.query(
            'DELETE FROM Paciente_alergia WHERE pk_fk_paciente = ? AND pk_fk_alergia = ?',
            [id, idAlergia]
        );
        res.redirect(`/pacientes/expediente/${id}`); } catch (error) { console.error('Error al quitar alergia:', error); res.redirect(`/pacientes/expediente/${id}`);
    }
});

module.exports = router;