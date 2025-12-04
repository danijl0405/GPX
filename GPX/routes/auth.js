var express = require('express');
var router = express.Router();
var dataProvider = require('../data/dataProvider');

// POST login - Autenticar usuario
router.post('/login', function (req, res, next) {
    const { email, password } = req.body;

    // Buscar usuario en la base de datos
    const users = dataProvider.getUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        // Guardar usuario en la sesión (sin la contraseña)
        const { password, ...userWithoutPassword } = user;
        req.session.user = userWithoutPassword;

        // Redirigir al dashboard
        res.redirect('/dashboard');
    } else {
        // Credenciales inválidas
        res.render('login', {
            title: 'Iniciar Sesión - Galpe Exchange',
            error: 'Correo electrónico o contraseña incorrectos'
        });
    }
});

// POST register - Registrar nuevo usuario
router.post('/register', function (req, res, next) {
    const { name, email, password } = req.body;

    // Validación básica
    if (!name || !email || !password) {
        return res.render('register', {
            title: 'Registrarse - Galpe Exchange',
            error: 'Todos los campos son obligatorios'
        });
    }

    // Verificar si el usuario ya existe
    const users = dataProvider.getUsers();
    const existingUser = users.find(u => u.email === email);

    if (existingUser) {
        return res.render('register', {
            title: 'Registrarse - Galpe Exchange',
            error: 'Este correo electrónico ya está registrado'
        });
    }

    // Crear nuevo usuario
    const newUser = {
        id: users.length + 1,
        name: name,
        email: email,
        password: password, // En producción, usar bcrypt para hashear
        balance: {
            btc: 0,
            eur: 0
        },
        assets: []
    };

    // Guardar usuario (esto debería escribir en el archivo JSON)
    users.push(newUser);
    dataProvider.saveUsers(users);

    // Guardar usuario en la sesión (sin la contraseña)
    const { password: _, ...userWithoutPassword } = newUser;
    req.session.user = userWithoutPassword;

    // Redirigir al dashboard
    res.redirect('/dashboard');
});

// GET logout - Cerrar sesión
router.get('/logout', function (req, res, next) {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;
