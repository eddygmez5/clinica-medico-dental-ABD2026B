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

// Ruta principal (Login)
app.get('/', (req, res) => {
    // Si ya inició sesión, lo mandamos directo al dashboard sin pedir clave otra vez
    if (req.session.usuario) {
        return res.redirect('/dashboard');
    }
    res.render('auth/login');
});

// Ruta protegida del Dashboard
app.get('/dashboard', verificarSesion, async (req, res) => {
    try {
        // Consultamos cuántas citas hay para la fecha de hoy (CURDATE())
        const [citasHoy] = await db.query(
            'SELECT COUNT(*) AS total FROM Cita WHERE fecha = CURDATE()'
        );

        // Consultamos el total de pacientes registrados
        const [pacientes] = await db.query(
            'SELECT COUNT(*) AS total FROM Paciente'
        );

        res.render('dashboard', {
            usuario: req.session.usuario,
            totalCitasHoy: citasHoy[0].total,
            totalPacientes: pacientes[0].total
        });
    } catch (error) {
        console.error('Error cargando dashboard:', error);
        res.render('dashboard', {
            usuario: req.session.usuario,
            totalCitasHoy: 0,
            totalPacientes: 0
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});