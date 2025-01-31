require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create required directories if they don't exist
['public', 'uploads'].forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('Connected to MongoDB');
    createInitialAdmin();
})
.catch(err => {
    console.error('MongoDB connection error:', err);
});

// Models
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const photoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    imageUrl: { type: String, required: true },
    category: String,
    tags: [String],
    fileSize: Number,
    featured: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Photo = mongoose.model('Photo', photoSchema);

// Create initial admin user
async function createInitialAdmin() {
    try {
        const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 8);
            const admin = new User({
                email: process.env.ADMIN_EMAIL,
                password: hashedPassword
            });
            await admin.save();
            console.log('Initial admin user created');
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb('Error: Images only!');
    }
});

// Authentication Middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded._id });
        if (!user) throw new Error();
        req.user = user;
        next();
    } catch (e) {
        res.status(401).send({ error: 'Please authenticate.' });
    }
};

// Routes
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', email);
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid login credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid login credentials' });
        }

        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
        res.json({ user: { email: user.email }, token });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Upload photo
app.post('/api/photos', auth, upload.single('photo'), async (req, res) => {
    try {
        const photo = new Photo({
            title: req.body.title,
            description: req.body.description,
            imageUrl: `/uploads/${req.file.filename}`,
            category: req.body.category,
            tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
            fileSize: req.file.size,
            featured: req.body.featured === 'true'
        });
        await photo.save();
        res.status(201).send(photo);
    } catch (e) {
        console.error('Upload error:', e);
        res.status(400).send({ error: 'Error uploading photo' });
    }
});

// Get all photos
app.get('/api/photos', async (req, res) => {
    try {
        const photos = await Photo.find({}).sort({ createdAt: -1 });
        res.send(photos);
    } catch (e) {
        res.status(500).send({ error: 'Error fetching photos' });
    }
});

// Delete photo
app.delete('/api/photos/:id', auth, async (req, res) => {
    try {
        const photo = await Photo.findByIdAndDelete(req.params.id);
        if (!photo) {
            return res.status(404).send({ error: 'Photo not found' });
        }
        const filePath = path.join(__dirname, 'uploads', path.basename(photo.imageUrl));
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.send(photo);
    } catch (e) {
        console.error('Delete error:', e);
        res.status(500).send({ error: 'Error deleting photo' });
    }
});

// Serve admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ error: 'Something broke!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
