// npm run dev (en modo desarrollo)
// npm start (en modo produccion)

const express = require('express');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const db = require('./config/db');

const authRoutes = require('./routes/auth');
const verificarSesion = require('./middleware/verificarSesion');
const perfilRoutes = require('./routes/perfil');
const citasRoutes = require('./routes/citas');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración del almacén de sesiones en MySQL
const sessionStore = new MySQLStore({}, db);

app.use(session({
    key: 'sesion_clinica',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 } // La sesión dura 8 horas
}));

// Configuración de EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares para formularios y archivos estáticos
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de autenticación (login, logout, registro, recuperar)
app.use('/', authRoutes);

// Rutas de perfil (ver y actualizar perfil)
app.use('/perfil', perfilRoutes);

// Rutas de citas (ver agenda, agendar, cancelar)
app.use('/citas', citasRoutes);

// Ruta principal (Login)
app.get('/', (req, res) => {
    // Si ya inició sesión, lo mandamos directo al dashboard sin pedir clave otra vez
    if (req.session.usuario) {
        return res.redirect('/dashboard');
    }
    res.render('auth/login');
});

// Ruta protegida del Dashboard (adaptada por rol)
app.get('/dashboard', verificarSesion, async (req, res) => {
    const usuario = req.session.usuario;
    let totalCitasHoy = 0;
    let perfilIncompleto = false;

    try {
        if (usuario.rol === 'Medico') {
            // Buscamos el pk_medico ligado a este usuario
            const [medico] = await db.query(
                'SELECT pk_medico FROM Medico WHERE fk_usuario = ?',
                [usuario.id]
            );

            if (medico.length > 0) {
                const [citasDoctor] = await db.query(
                    'SELECT COUNT(*) AS total FROM Cita WHERE fecha = CURDATE() AND fk_medico = ?',
                    [medico[0].pk_medico]
                );
                totalCitasHoy = citasDoctor[0].total;
            } else {
                // El médico registró cuenta pero aún no llena sus datos en /perfil
                perfilIncompleto = true;
            }
        } else {
            // Recepcionista ve todas las citas del día en toda la clínica
            const [citasClinica] = await db.query(
                'SELECT COUNT(*) AS total FROM Cita WHERE fecha = CURDATE()'
            );
            totalCitasHoy = citasClinica[0].total;
        }

        const [pacientes] = await db.query('SELECT COUNT(*) AS total FROM Paciente');

        res.render('dashboard', {
            usuario,
            totalCitasHoy,
            totalPacientes: pacientes[0].total,
            perfilIncompleto
        });
    } catch (error) {
        console.error('Error cargando dashboard:', error);
        res.render('dashboard', {
            usuario,
            totalCitasHoy: 0,
            totalPacientes: 0,
            perfilIncompleto: false
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});