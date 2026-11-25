const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // Viene integrado en Node, sirve para generar códigos aleatorios
const db = require('../config/db');
const transporter = require('../config/mail');

// 1. PROCESAR LOGIN
router.post('/login', async (req, res) => {
    const { nombre_usuario, contrasena } = req.body;

    try {
        const [usuarios] = await db.query('SELECT * FROM Usuario WHERE nombre_usuario = ?', [nombre_usuario]);

        if (usuarios.length === 0) {
            return res.render('auth/login', { error: 'Usuario o contraseña incorrectos' });
        }

        const usuario = usuarios[0];
        const passwordValida = await bcrypt.compare(contrasena, usuario.contrasena);

        if (!passwordValida) {
            return res.render('auth/login', { error: 'Usuario o contraseña incorrectos' });
        }

        // Verificar si ya confirmó su correo
        if (usuario.estado_activacion === 0) {
            return res.render('auth/login', { error: 'Debes confirmar tu cuenta desde el correo que te enviamos.' });
        }

        // Guardar auditoría en tabla Sesion (SQL directo y sencillo)
        const ip = req.ip || req.connection.remoteAddress;
        const useragent = req.headers['user-agent'] || 'Desconocido';

        const [sesionResult] = await db.query(
            'INSERT INTO Sesion (fk_usuario, login, ip, useragent) VALUES (?, NOW(), ?, ?)',
            [usuario.pk_usuario, ip, useragent]
        );

        req.session.usuario = {
            id: usuario.pk_usuario,
            nombre: usuario.nombre_usuario,
            rol: usuario.rol,
            pk_sesion: sesionResult.insertId
        };

        res.redirect('/dashboard');

    } catch (error) {
        console.error(error);
        res.render('auth/login', { error: 'Error al iniciar sesión' });
    }
});

// 2. CERRAR SESIÓN
router.get('/logout', async (req, res) => {
    try {
        if (req.session.usuario && req.session.usuario.pk_sesion) {
            await db.query(
                'UPDATE Sesion SET logout = NOW(), duration = TIMEDIFF(NOW(), login) WHERE pk_sesion = ?',
                [req.session.usuario.pk_sesion]
            );
        }
    } catch (error) {
        console.error(error);
    }

    req.session.destroy(() => {
        res.redirect('/');
    });
});

// MOSTRAR FORMULARIO DE REGISTRO
router.get('/registro', (req, res) => {
    res.render('auth/registro');
});

// PROCESAR REGISTRO Y ENVIAR CORREO DE CONFIRMACIÓN
router.post('/registro', async (req, res) => {
    const { nombre_usuario, email, rol, contrasena } = req.body;

    try {
        const hash = await bcrypt.hash(contrasena, 10);
        // Generamos un código aleatorio único de 32 caracteres
        const codigoActivacion = crypto.randomBytes(16).toString('hex');

        // Insertamos el usuario con estado_activacion = 0 (inactivo hasta que abra el correo)
        await db.query(
            `INSERT INTO Usuario (nombre_usuario, email, contrasena, rol, codigo_activacion, estado_activacion) 
             VALUES (?, ?, ?, ?, ?, 0)`,
            [nombre_usuario, email, hash, rol, codigoActivacion]
        );

        // Armamos el enlace de confirmación
        const enlace = `http://localhost:3000/activar/${codigoActivacion}`;

        // Enviamos el correo
        await transporter.sendMail({
            from: `"Clínica Médico-Dental" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Confirma tu registro - Clínica Médico-Dental',
            html: `
                <h2>¡Bienvenido, ${nombre_usuario}!</h2>
                <p>Para activar tu cuenta y poder iniciar sesión, haz clic en el siguiente enlace:</p>
                <a href="${enlace}" style="padding: 10px 15px; background-color: #0d6efd; color: white; text-decoration: none; border-radius: 5px;">Activar mi cuenta</a>
            `
        });

        res.render('auth/registro', {
            mensaje: 'Registro exitoso. Revisa tu correo electrónico para activar tu cuenta.'
        });

    } catch (error) {
        console.error(error);
        res.render('auth/registro', { error: 'El usuario o correo ya está registrado.' });
    }
});

// RUTA QUE RECIBE EL CLIC DEL CORREO PARA ACTIVAR LA CUENTA
router.get('/activar/:codigo', async (req, res) => {
    const { codigo } = req.params;

    try {
        // Buscamos quién tiene ese código y lo activamos (estado_activacion = 1)
        const [resultado] = await db.query(
            'UPDATE Usuario SET estado_activacion = 1, codigo_activacion = NULL WHERE codigo_activacion = ?',
            [codigo]
        );

        if (resultado.affectedRows === 0) {
            return res.send('El enlace de activación es inválido o la cuenta ya fue activada.');
        }

        res.send('<h2>¡Cuenta activada con éxito!</h2><a href="/">Ir a iniciar sesión</a>');

    } catch (error) {
        res.send('Error al activar la cuenta.');
    }
});

// 1. MOSTRAR FORMULARIO DE "OLVIDÉ MI CONTRASEÑA"
router.get('/recuperar', (req, res) => {
    res.render('auth/recuperar');
});

// 2. PROCESAR SOLICITUD Y ENVIAR CORREO CON TOKEN
router.post('/recuperar', async (req, res) => {
    const { email } = req.body;

    try {
        const [usuarios] = await db.query('SELECT * FROM Usuario WHERE email = ?', [email]);

        // Por seguridad, aunque el correo no exista mostramos el mismo mensaje para no revelar qué correos están registrados
        if (usuarios.length === 0) {
            return res.render('auth/recuperar', {
                mensaje: 'Si el correo está registrado, recibirás un enlace en unos momentos.'
            });
        }

        const usuario = usuarios[0];
        const token = crypto.randomBytes(20).toString('hex');

        // Guardamos el token y le damos 1 hora de vida (DATE_ADD)
        await db.query(
            'UPDATE Usuario SET token_recuperacion = ?, token_expiracion = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE pk_usuario = ?',
            [token, usuario.pk_usuario]
        );

        const enlace = `http://localhost:3000/restablecer/${token}`;

        await transporter.sendMail({
            from: `"Clínica Médico-Dental" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Restablecer contraseña - Clínica Médico-Dental',
            html: `
                <h3>Hola, ${usuario.nombre_usuario}</h3>
                <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón (válido por 1 hora):</p>
                <a href="${enlace}" style="padding: 10px 15px; background-color: #198754; color: white; text-decoration: none; border-radius: 5px;">Cambiar contraseña</a>
            `
        });

        res.render('auth/recuperar', {
            mensaje: 'Si el correo está registrado, recibirás un enlace en unos momentos.'
        });

    } catch (error) {
        console.error(error);
        res.render('auth/recuperar', { error: 'Error al procesar la solicitud.' });
    }
});

// 3. VALIDAR EL TOKEN CUANDO EL USUARIO ABRE EL ENLACE DEL CORREO
router.get('/restablecer/:token', async (req, res) => {
    const { token } = req.params;

    try {
        // Buscamos que el token coincida Y que la fecha actual sea menor a la de expiración
        const [usuarios] = await db.query(
            'SELECT * FROM Usuario WHERE token_recuperacion = ? AND token_expiracion > NOW()',
            [token]
        );

        if (usuarios.length === 0) {
            return res.send('<h3>El enlace es inválido o ya expiró (pasó más de 1 hora).</h3><a href="/recuperar">Solicitar uno nuevo</a>');
        }

        res.render('auth/restablecer', { token });

    } catch (error) {
        res.send('Error al validar el enlace.');
    }
});

// 4. GUARDAR LA NUEVA CONTRASEÑA ENCRIPTADA Y LIMPIAR EL TOKEN
router.post('/restablecer/:token', async (req, res) => {
    const { token } = req.params;
    const { contrasena } = req.body;

    try {
        const hash = await bcrypt.hash(contrasena, 10);

        // Actualizamos la contraseña y borramos el token para que el enlace no se pueda volver a usar
        const [resultado] = await db.query(
            'UPDATE Usuario SET contrasena = ?, token_recuperacion = NULL, token_expiracion = NULL WHERE token_recuperacion = ? AND token_expiracion > NOW()',
            [hash, token]
        );

        if (resultado.affectedRows === 0) {
            return res.send('El enlace expiró mientras escribías la contraseña. Intenta de nuevo.');
        }

        res.send('<h3>¡Contraseña actualizada correctamente!</h3><a href="/">Iniciar sesión con mi nueva clave</a>');

    } catch (error) {
        res.send('Error al guardar la nueva contraseña.');
    }
});

module.exports = router;