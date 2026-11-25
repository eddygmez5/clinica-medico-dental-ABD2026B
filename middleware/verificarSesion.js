function verificarSesion(req, res, next) {
    // Revisa si existe la variable 'usuario' dentro de la sesión activa
    if (req.session && req.session.usuario) {
        return next(); // Tiene permiso: lo deja pasar a la siguiente función/pantalla
    }
    // No tiene sesión: lo regresa a la pantalla de login
    res.redirect('/');
}

module.exports = verificarSesion;