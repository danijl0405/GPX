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


router.get('/retire', requireAuth, function (req, res, next) {
  const user = req.session.user; // Usuario de la sesión
  res.render('retire', {
    title: 'Retirar - Galpe Exchange',
    user: user // Opcional, si quieres mostrar balance u otra info
  });
});

module.exports = router;
