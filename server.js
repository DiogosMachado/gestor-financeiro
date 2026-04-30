require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

// ===== CONFIG =====
const JWT_SECRET = process.env.JWT_SECRET || "segredo";

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());

// ===== CONEXÃO MONGO =====
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.log("❌ MONGO_URL não definida");
}

mongoose.connect(MONGO_URL || "mongodb://127.0.0.1:27017/financas")
.then(() => console.log("🔥 Mongo conectado"))
.catch(err => console.log("❌ Erro Mongo:", err.message));

// ===== MODELS =====
const User = mongoose.models.User || mongoose.model("User", {
  email: String,
  senha: String
});

const Regra = mongoose.models.Regra || mongoose.model("Regra", {
  userId: String,
  descricao: String,
  tipo: String,
  valor: Number,
  valorParcela: Number,
  totalParcelas: Number,
  parcelasPagas: Number,
  ativo: Boolean
});

const Mes = mongoose.models.Mes || mongoose.model("Mes", {
  userId: String,
  mes: String,
  dados: Array,
  total: Number
});

// ===== AUTH =====
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ erro: "Sem token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ erro: "Token inválido" });
  }
}

// ===== CHECK DB =====
function checkDB(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ erro: "Banco não conectado" });
  }
  next();
}

// ===== ROTAS =====

// TESTE
app.get("/teste", (req, res) => {
  res.json({ ok: true });
});

// ===== AUTH =====

// REGISTRO
app.post("/register", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: "Preencha tudo" });
    }

    const existe = await User.findOne({ email });
    if (existe) {
      return res.status(400).json({ erro: "Usuário já existe" });
    }

    const hash = await bcrypt.hash(senha, 10);

    await User.create({ email, senha: hash });

    res.json({ ok: true });

  } catch (err) {
    console.log("ERRO REGISTER:", err);
    res.status(500).json({ erro: "Erro interno" });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: "Preencha tudo" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ erro: "Usuário não encontrado" });
    }

    const ok = await bcrypt.compare(senha, user.senha);

    if (!ok) {
      return res.status(400).json({ erro: "Senha inválida" });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET);

    res.json({ token });

  } catch (err) {
    console.log("ERRO LOGIN:", err);
    res.status(500).json({ erro: "Erro interno" });
  }
});

// ===== REGRAS =====

app.post("/regras", auth, checkDB, async (req, res) => {
  try {
    const regra = await Regra.create({
      ...req.body,
      userId: req.userId
    });
    res.json(regra);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get("/regras", auth, checkDB, async (req, res) => {
  try {
    const regras = await Regra.find({ userId: req.userId });
    res.json(regras);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== MES =====
app.get("/mes", auth, checkDB, async (req, res) => {
  try {
    const regras = await Regra.find({ userId: req.userId });

    let lista = [];

    regras.forEach(r => {
      if (!r.ativo) return;

      if (["fixo", "variavel", "entrada"].includes(r.tipo)) {
        lista.push({
          _id: r._id,
          desc: r.descricao,
          valor: r.valor,
          tipo: r.tipo
        });
      }

      if (r.tipo === "parcelado") {
        if (r.parcelasPagas < r.totalParcelas) {
          lista.push({
            _id: r._id,
            desc: r.descricao,
            valor: r.valorParcela,
            tipo: "parcelado",
            parcela: `${r.parcelasPagas + 1}/${r.totalParcelas}`
          });
        }
      }
    });

    res.json(lista);

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== HISTÓRICO =====
app.get("/historico", auth, checkDB, async (req, res) => {
  try {
    const meses = await Mes.find({ userId: req.userId }).sort({ mes: -1 });
    res.json(meses);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== FRONTEND =====
app.use(express.static(path.join(__dirname, "public")));

// ⚠️ CORREÇÃO CRÍTICA (ESSA É A CAUSA DO SEU ERRO)
app.get("*", (req, res) => {
  // NÃO deixa API cair aqui
  if (req.path.startsWith("/login") || 
      req.path.startsWith("/register") ||
      req.path.startsWith("/regras") ||
      req.path.startsWith("/mes") ||
      req.path.startsWith("/historico")) {
    return res.status(404).json({ erro: "Rota não encontrada" });
  }

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== SERVER =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta " + PORT);
});