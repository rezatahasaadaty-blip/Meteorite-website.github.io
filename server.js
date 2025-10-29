const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// اتصال به دیتابیس
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/data/meteorites.db'
  : path.join(__dirname, 'database', 'meteorites.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('خطا در اتصال به دیتابیس:', err.message);
  } else {
    console.log('اتصال به دیتابیس موفقیت‌آمیز بود');
    initializeDatabase();
  }
});

function initializeDatabase() {
  // ایجاد جداول
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS meteorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT NOT NULL,
      weight REAL,
      price REAL,
      description TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // بررسی وجود داده
    db.get("SELECT COUNT(*) as count FROM meteorites", (err, row) => {
      if (row.count === 0) {
        // درج داده‌های نمونه
        const sampleData = [
          {
            name: "شهاب‌سنگ کندریت معمولی",
            type: "کندریت",
            location: "صحرای آفریقا",
            weight: 150,
            price: 5200000,
            description: "شهاب‌سنگ سنگی با دانه‌های کندرول، قدیمی‌ترین نوع شهاب‌سنگ با قدمت ۴.۵ میلیارد سال",
            image_url: "/images/meteorite1.jpg"
          },
          {
            name: "شهاب‌سنگ آهنی", 
            type: "آهنی",
            location: "قطب جنوب",
            weight: 280,
            price: 8750000,
            description: "شهاب‌سنگ فلزی با درصد بالای آهن و نیکل، دارای الگوی ویدمن اشتاتن",
            image_url: "/images/meteorite2.jpg"
          },
          {
            name: "شهاب‌سنگ مریخی",
            type: "مریخی",
            location: "عمان",
            weight: 85,
            price: 25000000,
            description: "شهاب‌سنگ نادر با منشأ سیاره مریخ، حاوی مواد معدنی منحصر به فرد",
            image_url: "/images/meteorite3.jpg"
          },
          {
            name: "شهاب‌سنگ قمری",
            type: "قمری",
            location: "لیبی",
            weight: 120,
            price: 32500000,
            description: "شهاب‌سنگ بسیار نادر از کره ماه، مشابه نمونه‌های مأموریت آپولو",
            image_url: "/images/meteorite4.jpg"
          }
        ];

        const stmt = db.prepare(`INSERT INTO meteorites 
          (name, type, location, weight, price, description, image_url) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`);
        
        sampleData.forEach(meteorite => {
          stmt.run([
            meteorite.name,
            meteorite.type,
            meteorite.location, 
            meteorite.weight,
            meteorite.price,
            meteorite.description,
            meteorite.image_url
          ], function(err) {
            if (err) {
              console.error('خطا در درج داده:', err);
            } else {
              console.log(`شهاب‌سنگ اضافه شد: ${meteorite.name}`);
            }
          });
        });
        
        stmt.finalize();
        console.log('✅ داده‌های نمونه با موفقیت اضافه شدند');
      }
    });
  });
}

// Routes
app.get('/api/meteorites', (req, res) => {
  const { search, type, location, min_price, max_price } = req.query;
  
  let query = 'SELECT * FROM meteorites WHERE 1=1';
  let params = [];

  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ? OR location LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  if (location) {
    query += ' AND location = ?';
    params.push(location);
  }

  if (min_price) {
    query += ' AND price >= ?';
    params.push(min_price);
  }

  if (max_price) {
    query += ' AND price <= ?';
    params.push(max_price);
  }

  query += ' ORDER BY created_at DESC';

  console.log('دریافت شهاب‌سنگ‌ها با فیلتر:', { search, type, location });

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('خطا در查询 دیتابیس:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ 
      success: true,
      meteorites: rows 
    });
  });
});

app.get('/api/meteorites/:id', (req, res) => {
  const id = req.params.id;
  
  db.get('SELECT * FROM meteorites WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'شهاب‌سنگ پیدا نشد' });
      return;
    }
    
    res.json({ 
      success: true,
      meteorite: row 
    });
  });
});

app.post('/api/orders', (req, res) => {
  const { meteorite_id, quantity, customer_name, customer_email, customer_phone } = req.body;
  
  if (!meteorite_id || !quantity || !customer_name || !customer_email) {
    return res.status(400).json({ 
      success: false,
      error: 'لطفاً تمام فیلدهای ضروری را پر کنید' 
    });
  }

  // محاسبه قیمت
  db.get('SELECT * FROM meteorites WHERE id = ?', [meteorite_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'شهاب‌سنگ پیدا نشد' });
      return;
    }
    
    const total_price = row.price * quantity;
    const order_id = 'ORD-' + Date.now();
    
    // در حالت واقعی اینجا order را در دیتابیس ذخیره می‌کردیم
    console.log('📦 سفارش جدید:', {
      order_id,
      meteorite_id,
      customer_name,
      total_price
    });
    
    res.json({ 
      success: true,
      message: 'سفارش با موفقیت ثبت شد',
      order_id: order_id,
      total_price: total_price,
      customer_name: customer_name
    });
  });
});

app.post('/api/contact', (req, res) => {
  const { name, email, message, subject } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({ 
      success: false,
      error: 'لطفاً نام، ایمیل و پیام را وارد کنید' 
    });
  }

  // در حالت واقعی اینجا پیام را در دیتابیس ذخیره می‌کردیم
  console.log('📧 پیام جدید:', { name, email, subject, message });
  
  res.json({ 
    success: true,
    message: 'پیام شما با موفقیت ارسال شد. به زودی با شما تماس می‌گیریم.'
  });
});

// Route برای ارائه فرانت‌اند
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 سرور در پورت ${PORT} اجرا شد`);
  console.log(`🌍 محیط: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ مسیر دیتابیس: ${dbPath}`);
});

module.exports = app;