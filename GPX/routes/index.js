const express = require('express');
const router = express.Router();
const dataProvider = require('../data/dataProvider');
const { requireAuth } = require('../middleware/auth');

/* GET home page. */
router.get('/', function (req, res, next) {
  try {
    const coins = dataProvider.getCoins();
    res.render('index', {
      title: 'Galpe Exchange',
      coins: coins
    });
  } catch (error) {
    next(error);
  }
});

router.get('/support', function (req, res, next) {
  res.render('support', { title: 'Soporte - Galpe Exchange' });
});

router.get('/contact', function (req, res, next) {
  res.render('contact', { title: 'Soporte técnico - Galpe Exchange' });
});

router.post('/support/contact', function (req, res, next) {
  // Aquí puedes agregar la lógica para procesar el formulario
  // Por ahora, solo redirigimos de vuelta con un mensaje
  res.redirect('/contact?sent=true');
});

// Rutas protegidas - requieren autenticación
router.get('/dashboard', requireAuth, function (req, res, next) {
  try {
    const user = req.session.user; // Usuario de la sesión
    const coins = dataProvider.getCoins();

    // Map user assets to include coin details (like icon color)
    const userAssets = user.assets.map(asset => {
      const coin = coins.find(c => c.symbol === asset.symbol);
      return { ...asset, ...coin }; // Merge asset amount with coin details
    });

    res.render('dashboard', {
      title: 'Panel - Galpe Exchange',
      user: user,
      assets: userAssets,
      coins: coins
    });
  } catch (error) {
    next(error);
  }
});

router.get('/market', function (req, res, next) {
  try {
    const coins = dataProvider.getCoins();
    // Sort for gainers/losers
    const sortedByChange = [...coins].sort((a, b) => b.change_24h - a.change_24h);
    const gainers = sortedByChange.slice(0, 4);
    const losers = sortedByChange.slice().reverse().slice(0, 4);

    res.render('market', {
      title: 'Mercado - Galpe Exchange',
      coins: coins,
      gainers: gainers,
      losers: losers
    });
  } catch (error) {
    next(error);
  }
});

// Trading page for specific coin
router.get('/trade/:symbol', requireAuth, function (req, res, next) {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const coins = dataProvider.getCoins();
    const coin = coins.find(c => c.symbol === symbol);

    if (!coin) {
      return res.redirect('/market');
    }

    res.render('trade', {
      title: coin.name + ' - Trading',
      coin: coin,
      coins: coins, // Para el sidebar de pares
      user: req.session.user
    });
  } catch (error) {
    next(error);
  }
});

router.get('/deposit', requireAuth, (req, res) => {
  res.render('deposit', {
    title: 'Depositar - Galpe Exchange',
    user: req.session.user,
    error: null,
    success: null
  });
});

router.post('/deposit', requireAuth, (req, res, next) => {
  try {
    const { amount, currency } = req.body;

    const curr = (currency || 'eur').toLowerCase();
    const parsedAmount = Number.parseFloat(String(amount).replace(',', '.'));

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.render('deposit', {
        title: 'Depositar - Galpe Exchange',
        user: req.session.user,
        error: 'Introduce una cantidad válida (mayor que 0).',
        success: null
      });
    }

    const allowed = new Set(['eur', 'btc']);
    if (!allowed.has(curr)) {
      return res.render('deposit', {
        title: 'Depositar - Galpe Exchange',
        user: req.session.user,
        error: 'Moneda no soportada.',
        success: null
      });
    }

    const users = dataProvider.getUsers();
    const idx = users.findIndex(u => u.id === req.session.user.id);

    if (idx === -1) {
      return res.redirect('/auth/logout');
    }

    users[idx].balance = users[idx].balance || { eur: 0, btc: 0 };
    users[idx].balance[curr] = (Number(users[idx].balance[curr]) || 0) + parsedAmount;

    const ok = dataProvider.saveUsers(users);
    if (!ok) {
      return res.render('deposit', {
        title: 'Depositar - Galpe Exchange',
        user: req.session.user,
        error: 'No se pudo guardar el depósito.',
        success: null
      });
    }

    // actualizar sesión (sin password)
    const { password, ...userWithoutPassword } = users[idx];
    req.session.user = userWithoutPassword;

    return res.render('deposit', {
      title: 'Depositar - Galpe Exchange',
      user: req.session.user,
      error: null,
      success: `Depósito: +${parsedAmount} ${curr.toUpperCase()}`
    });
  } catch (err) {
    next(err);
  }
});

// Rutas públicas de autenticación
router.get('/login', function (req, res, next) {
  // Si ya está autenticado, redirigir al dashboard
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', { title: 'Iniciar Sesión - Galpe Exchange' });
});

router.get('/register', function (req, res, next) {
  // Si ya está autenticado, redirigir al dashboard
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('register', { title: 'Registrarse - Galpe Exchange' });
});


//   WITHDRAW (GET)
router.get('/withdraw', requireAuth, (req, res) => {
  res.render('withdraw', {
    title: 'Retirar - Galpe Exchange',
    user: req.session.user,
    error: null,
    success: null,
    history: req.session.user.withdrawHistory || []
  });
});

//   WITHDRAW (POST) - SIMULADO
router.post('/withdraw', requireAuth, (req, res, next) => {
  try {
    const { amount, currency, destination } = req.body;

    const curr = (currency || 'eur').toLowerCase();
    const parsedAmount = Number.parseFloat(String(amount).replace(',', '.'));
    const dest = (destination || '').trim();

    // Validaciones básicas
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.render('withdraw', {
        title: 'Retirar - Galpe Exchange',
        user: req.session.user,
        error: 'Introduce una cantidad válida.',
        success: null,
        history: req.session.user.withdrawHistory || []
      });
    }

    if (!['eur', 'btc'].includes(curr)) {
      return res.render('withdraw', {
        title: 'Retirar - Galpe Exchange',
        user: req.session.user,
        error: 'Moneda no soportada.',
        success: null,
        history: req.session.user.withdrawHistory || []
      });
    }

    // Para que parezca real: pedir un "destino" (IBAN / wallet), pero sin validarlo a nivel banco
    if (dest.length < 6) {
      return res.render('withdraw', {
        title: 'Retirar - Galpe Exchange',
        user: req.session.user,
        error: 'Introduce un destino válido (IBAN o wallet).',
        success: null,
        history: req.session.user.withdrawHistory || []
      });
    }

    const users = dataProvider.getUsers();
    const idx = users.findIndex(u => u.id === req.session.user.id);

    if (idx === -1) return res.redirect('/auth/logout');

    // Balance y fondos suficientes
    users[idx].balance = users[idx].balance || { eur: 0, btc: 0 };
    const current = Number(users[idx].balance[curr]) || 0;

    if (parsedAmount > current) {
      return res.render('withdraw', {
        title: 'Retirar - Galpe Exchange',
        user: req.session.user,
        error: `Fondos insuficientes. Tienes ${curr === 'btc' ? current : current.toFixed(2)} ${curr.toUpperCase()}.`,
        success: null,
        history: req.session.user.withdrawHistory || []
      });
    }

    // (Opcional) “fee” simulada para que parezca exchange
    const fee = curr === 'btc' ? 0.0001 : 0.50; // simple
    const totalDebit = parsedAmount + fee;

    if (totalDebit > current) {
      return res.render('withdraw', {
        title: 'Retirar - Galpe Exchange',
        user: req.session.user,
        error: `Saldo insuficiente para cubrir comisión. Comisión: ${fee} ${curr.toUpperCase()}.`,
        success: null,
        history: req.session.user.withdrawHistory || []
      });
    }

    // Restar saldo
    users[idx].balance[curr] = current - totalDebit;

    // Historial
    users[idx].withdrawHistory = Array.isArray(users[idx].withdrawHistory)
      ? users[idx].withdrawHistory
      : [];

    users[idx].withdrawHistory.unshift({
      id: Date.now().toString(),
      type: 'withdraw',
      currency: curr,
      amount: parsedAmount,
      fee,
      destination: dest,
      status: 'completed', // simulado
      createdAt: new Date().toISOString()
    });

    users[idx].withdrawHistory = users[idx].withdrawHistory.slice(0, 50);

    // Guardar
    const ok = dataProvider.saveUsers(users);
    if (!ok) {
      return res.render('withdraw', {
        title: 'Retirar - Galpe Exchange',
        user: req.session.user,
        error: 'Error al guardar el retiro.',
        success: null,
        history: req.session.user.withdrawHistory || []
      });
    }

    // Actualizar sesión
    const { password, ...userWithoutPassword } = users[idx];
    req.session.user = userWithoutPassword;

    return res.render('withdraw', {
      title: 'Retirar - Galpe Exchange',
      user: req.session.user,
      error: null,
      success: `Retiro simulado: -${parsedAmount} ${curr.toUpperCase()} (comisión ${fee} ${curr.toUpperCase()}).`,
      history: req.session.user.withdrawHistory || []
    });
  } catch (err) {
    next(err);
  }
});
router.get('/support/reset-password', function (req, res, next) {
  res.render('reset-password', { title: 'Cambiar contraseña - Galpe Exchange' });
});

router.get('/support/change-email', function (req, res, next) {
  res.render('change-email', { title: 'Cambiar correo electrónico - Galpe Exchange' });
});

router.post('/support/change-email', function (req, res, next) {
  try {
    const { currentEmail, newEmail, password } = req.body;

    // Validación básica
    if (!currentEmail || !newEmail || !password) {
      return res.render('change-email', {
        title: 'Cambiar correo electrónico - Galpe Exchange',
        error: 'Por favor, completa todos los campos'
      });
    }

    // Validar formato de email
    if (!newEmail.includes('@')) {
      return res.render('change-email', {
        title: 'Cambiar correo electrónico - Galpe Exchange',
        error: 'Por favor, introduce un email válido'
      });
    }

    // Verificar que el nuevo email no sea igual al actual
    if (currentEmail === newEmail) {
      return res.render('change-email', {
        title: 'Cambiar correo electrónico - Galpe Exchange',
        error: 'El nuevo correo electrónico debe ser diferente al actual'
      });
    }

    // Buscar usuario por email actual
    const users = dataProvider.getUsers();
    const userIndex = users.findIndex(u => u.email === currentEmail);

    if (userIndex === -1) {
      return res.render('change-email', {
        title: 'Cambiar correo electrónico - Galpe Exchange',
        error: 'No se encontró ningún usuario con ese correo electrónico'
      });
    }

    // Verificar contraseña
    if (users[userIndex].password !== password) {
      return res.render('change-email', {
        title: 'Cambiar correo electrónico - Galpe Exchange',
        error: 'La contraseña es incorrecta'
      });
    }

    // Verificar que el nuevo email no esté en uso
    const emailExists = users.find(u => u.email === newEmail && u.id !== users[userIndex].id);
    if (emailExists) {
      return res.render('change-email', {
        title: 'Cambiar correo electrónico - Galpe Exchange',
        error: 'Este correo electrónico ya está en uso por otra cuenta'
      });
    }

    // Actualizar correo electrónico
    users[userIndex].email = newEmail;

    // Guardar en el archivo JSON
    const saved = dataProvider.saveUsers(users);

    if (!saved) {
      return res.render('change-email', {
        title: 'Cambiar correo electrónico - Galpe Exchange',
        error: 'Error al guardar los cambios. Por favor, intenta de nuevo.'
      });
    }

    // Si el usuario está en sesión, actualizar la sesión también
    if (req.session.user && req.session.user.email === currentEmail) {
      const { password: _, ...userWithoutPassword } = users[userIndex];
      req.session.user = userWithoutPassword;
    }

    res.render('change-email', {
      title: 'Cambiar correo electrónico - Galpe Exchange',
      success: 'Correo electrónico cambiado exitosamente. Ya puedes iniciar sesión con tu nuevo correo electrónico.'
    });
  } catch (error) {
    console.error('Error al cambiar correo electrónico:', error);
    res.render('change-email', {
      title: 'Cambiar correo electrónico - Galpe Exchange',
      error: 'Ocurrió un error al cambiar el correo electrónico. Por favor, intenta de nuevo.'
    });
  }
});

router.post('/support/reset-password', function (req, res, next) {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    // Validación básica
    if (!email || !newPassword || !confirmPassword) {
      return res.render('reset-password', {
        title: 'Cambiar contraseña - Galpe Exchange',
        error: 'Por favor, completa todos los campos'
      });
    }

    // Validar que las contraseñas coincidan
    if (newPassword !== confirmPassword) {
      return res.render('reset-password', {
        title: 'Cambiar contraseña - Galpe Exchange',
        error: 'Las contraseñas no coinciden'
      });
    }

    // Validar longitud mínima
    if (newPassword.length < 6) {
      return res.render('reset-password', {
        title: 'Cambiar contraseña - Galpe Exchange',
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Buscar usuario por email
    const users = dataProvider.getUsers();
    const userIndex = users.findIndex(u => u.email === email);

    if (userIndex === -1) {
      return res.render('reset-password', {
        title: 'Cambiar contraseña - Galpe Exchange',
        error: 'No se encontró ningún usuario con ese correo electrónico'
      });
    }

    // Actualizar contraseña
    users[userIndex].password = newPassword; // En producción, usar bcrypt para hashear

    // Guardar en el archivo JSON
    const saved = dataProvider.saveUsers(users);

    if (!saved) {
      return res.render('reset-password', {
        title: 'Cambiar contraseña - Galpe Exchange',
        error: 'Error al guardar los cambios. Por favor, intenta de nuevo.'
      });
    }

    // Si el usuario está en sesión, actualizar la sesión también
    if (req.session.user && req.session.user.email === email) {
      req.session.user = { ...req.session.user };
    }

    res.render('reset-password', {
      title: 'Cambiar contraseña - Galpe Exchange',
      success: 'Contraseña cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.'
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.render('reset-password', {
      title: 'Cambiar contraseña - Galpe Exchange',
      error: 'Ocurrió un error al cambiar la contraseña. Por favor, intenta de nuevo.'
    });
  }
});

module.exports = router;
