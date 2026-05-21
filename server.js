const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// --- CLES CHARGILY V2 (Remplacer par tes vraies clés de production plus tard) ---
const CHARGILY_SECRET_KEY = process.env.CHARGILY_SECRET_KEY || 'test_sk_YOUR_TEST_KEY_HERE';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `product-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Images only'));
  }
});

// Helpers
const readJSON = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return []; }
};
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

const WILAYAS = [
  "01 - Adrar","02 - Chlef","03 - Laghouat","04 - Oum El Bouaghi", "05 - Batna","06 - Béjaïa","07 - Biskra","08 - Béchar", "09 - Blida","10 - Bouira","11 - Tamanrasset","12 - Tébessa", "13 - Tlemcen","14 - Tiaret","15 - Tizi Ouzou","16 - Alger", "17 - Djelfa","18 - Jijel","19 - Sétif","20 - Saïda", "21 - Skikda","22 - Sidi Bel Abbès","23 - Annaba","24 - Guelma", "25 - Constantine","26 - Médéa","27 - Mostaganem","28 - M'Sila", "29 - Mascara","30 - Ouargla","31 - Oran","32 - El Bayadh", "33 - Illizi","34 - Bordj Bou Arréridj","35 - Boumerdès","36 - El Tarf", "37 - Tindouf","38 - Tissemsilt","39 - El Oued","40 - Khenchela", "41 - Souk Ahras","42 - Tipaza","43 - Mila","44 - Aïn Defla", "45 - Naâma","46 - Aïn Témouchent","47 - Ghardaïa","48 - Relizane", "49 - Timimoun","50 - Bordj Badji Mokhtar","51 - Ouled Djellal", "52 - Béni Abbès","53 - In Salah","54 - In Guezzam", "55 - Touggourt","56 - Djanet","57 - M'Ghair","58 - El Meniaa"
];

// ===== PRODUCT ROUTES =====
app.get('/api/products', (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const active = products.filter(p => p.active !== false);
  res.json(active);
});

app.get('/api/admin/products', (req, res) => {
  res.json(readJSON(PRODUCTS_FILE));
});

app.get('/api/products/:id', (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const p = products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

app.post('/api/admin/products', (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const body = req.body;
  const newProduct = {
    id: body.id || uuidv4().slice(0,8),
    name: body.name || { fr: '', ar: '', en: '' },
    tagline: body.tagline || { fr: '', ar: '', en: '' },
    description: body.description || { fr: '', ar: '', en: '' },
    price: body.price || '0',
    currency: body.currency || 'DA',
    priceNote: body.priceNote || { fr: '', ar: '', en: '' },
    features: body.features || { fr: [], ar: [], en: [] },
    rating: parseFloat(body.rating) || 4.8,
    reviews: parseInt(body.reviews) || 0,
    image: body.image || null,
    badge: body.badge || { fr: '', ar: '', en: '' },
    badgeColor: body.badgeColor || '#1A56DB',
    category: body.category || 'other',
    active: body.active !== false
  };
  products.push(newProduct);
  writeJSON(PRODUCTS_FILE, products);
  res.json({ success: true, product: newProduct });
});

app.put('/api/admin/products/:id', (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  products[idx] = { ...products[idx], ...req.body, id: req.params.id };
  writeJSON(PRODUCTS_FILE, products);
  res.json({ success: true, product: products[idx] });
});

app.post('/api/admin/products/:id/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const products = readJSON(PRODUCTS_FILE);
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  
  if (products[idx].image) {
    const oldPath = path.join(UPLOADS_DIR, path.basename(products[idx].image));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  
  products[idx].image = `/uploads/${req.file.filename}`;
  writeJSON(PRODUCTS_FILE, products);
  res.json({ success: true, image: products[idx].image });
});

app.delete('/api/admin/products/:id', (req, res) => {
  let products = readJSON(PRODUCTS_FILE);
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (products[idx].image) {
    const imgPath = path.join(UPLOADS_DIR, path.basename(products[idx].image));
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  products.splice(idx, 1);
  writeJSON(PRODUCTS_FILE, products);
  res.json({ success: true });
});

app.patch('/api/admin/products/:id/toggle', (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  products[idx].active = !products[idx].active;
  writeJSON(PRODUCTS_FILE, products);
  res.json({ success: true, active: products[idx].active });
});

// ===== ORDER & PAYMENT ROUTES =====
app.get('/api/wilayas', (req, res) => res.json(WILAYAS));

app.post('/api/orders', async (req, res) => {
  const { name, phone, wilaya, product_id, product_name, message, email } = req.body;
  if (!name || !phone || !wilaya || !product_id) {
    return res.status(400).json({ success: false, message: 'Champs obligatoires manquants.' });
  }

  // Vérifier le prix du produit
  const products = readJSON(PRODUCTS_FILE);
  const p = products.find(x => x.id === product_id);
  if (!p) return res.status(404).json({ success: false, message: 'Produit introuvable' });

  const orders = readJSON(ORDERS_FILE);
  const newOrder = {
    id: uuidv4().slice(0, 8).toUpperCase(),
    name, phone, wilaya, email: email || '',
    product_id, product_name: product_name || '',
    message: message || '',
    created_at: new Date().toISOString(),
    status: 'pending_payment' // Statut initial d'attente de paiement
  };
  
  orders.unshift(newOrder);
  writeJSON(ORDERS_FILE, orders);

  // Génération du lien de paiement Chargily V2
  try {
    const chargilyRes = await fetch('https://pay.chargily.net/test/api/v2/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHARGILY_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: parseInt(p.price),
        currency: "dzd",
        payment_method: "edahabia", // Force Eddahabia
        success_url: `http://localhost:3000/product/${product_id}?payment=success`,
        failure_url: `http://localhost:3000/product/${product_id}?payment=failed`,
        webhook_endpoint: `http://localhost:3000/api/webhook`, // Ton serveur recevra l'alerte ici
        description: `Commande ${newOrder.id} - ${product_name}`,
        metadata: { order_id: newOrder.id }
      })
    });

    const data = await chargilyRes.json();
    
    if (data.checkout_url) {
       return res.json({ success: true, checkout_url: data.checkout_url });
    } else {
       return res.status(500).json({ success: false, message: 'Erreur configuration Chargily' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Erreur de connexion à la passerelle de paiement' });
  }
});

// ===== WEBHOOK CHARGILY =====
app.post('/api/webhook', (req, res) => {
  // Chargily envoie une requête ici quand un client paie avec succès.
  const event = req.body;

  if (event && event.type === 'checkout.paid') {
     const orderId = event.data.metadata.order_id;
     const orders = readJSON(ORDERS_FILE);
     const idx = orders.findIndex(o => o.id === orderId);
     
     if (idx !== -1) {
        orders[idx].status = 'paid';
        writeJSON(ORDERS_FILE, orders);
        console.log(`[PAIEMENT REÇU] Commande ${orderId} payée avec succès !`);
     }
  }
  res.sendStatus(200); // Important: Dire à Chargily qu'on a bien reçu le message
});

// Admin order routes
app.get('/api/admin/orders', (req, res) => res.json(readJSON(ORDERS_FILE)));
app.patch('/api/admin/orders/:id/status', (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  orders[idx].status = req.body.status;
  writeJSON(ORDERS_FILE, orders);
  res.json({ success: true });
});
app.delete('/api/admin/orders/:id', (req, res) => {
  let orders = readJSON(ORDERS_FILE);
  orders = orders.filter(o => o.id !== req.params.id);
  writeJSON(ORDERS_FILE, orders);
  res.json({ success: true });
});

// Stats
app.get('/api/admin/stats', (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const products = readJSON(PRODUCTS_FILE);
  const today = new Date().toDateString();
  res.json({
    total_orders: orders.length,
    new_orders: orders.filter(o => o.status === 'pending_payment' || o.status === 'paid').length,
    today_orders: orders.filter(o => new Date(o.created_at).toDateString() === today).length,
    total_products: products.length,
    active_products: products.filter(p => p.active).length
  });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/product/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'product.html')));
app.get('/{*splat}', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`✅ Flux Software v2 running on http://localhost:${PORT}`));