var express = require('express');
var router = express.Router();
var dataProvider = require('../data/dataProvider');

// Middleware para proteger rutas que requieren autenticación
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

/* GET home page. */
router.get('/', function (req, res, next) {
  const coins = dataProvider.getCoins();
  res.render('index', {
    title: 'Galpe Exchange',
    coins: coins
  });
});

router.get('/support', function (req, res, next) {
  res.render('support', { title: 'Soporte - Galpe Exchange' });
});

// Rutas protegidas - requieren autenticación
router.get('/dashboard', requireAuth, function (req, res, next) {
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
});

router.get('/market', function (req, res, next) {
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
});

// Trading page for specific coin
router.get('/trade/:symbol', requireAuth, function (req, res, next) {
  const symbol = req.params.symbol.toUpperCase();
  const coins = dataProvider.getCoins();
  const coin = coins.find(c => c.symbol === symbol);

  if (!coin) {
    return res.redirect('/market');
  }

  res.render('trade', {
    title: `${coin.name} - Trading`,
    coin: coin,
    coins: coins, // Para el sidebar de pares
    user: req.session.user
  });
});

router.get('/deposit', requireAuth, function (req, res, next) {
  res.render('deposit', { title: 'Depositar - Galpe Exchange' });
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

module.exports = router;
