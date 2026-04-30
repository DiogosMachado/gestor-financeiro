require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());

// ===== CONEXÃO MONGO =====
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.log("❌ MONGO_URL não definida no ambiente");
}

mongoose.connect(MONGO_URL || "mongodb://127.0.0.1:27017/financas")
.then(() => console.log("🔥 Mongo conectado"))
.catch(err => console.log("❌ Erro Mongo:", err.message));

// ===== MODELS =====
const User = mongoose.model("User", {
  email: String,
  senha: String
});

const Regra = mongoose.model("Regra", {
  userId: String,
  descricao: String,
  tipo: String,
  valor: Number,
  valorParcela: Number,
  totalParcelas: Number,
  parcelasPagas: Number,
  ativo: Boolean
});

const Mes = mongoose.model("Mes", {
  userId: String,
  mes: String,
  dados: Array,
  total: Number
});

// ===== AUTH =====
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ erro: "Sem token" });

  try {
    const decoded = jwt.verify(token, "segredo");
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido" });
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

// ===== AUTH ROTAS =====

// REGISTRAR
app.post("/register", async (req, res) => {
  const { email, senha } = req.body;

  const existe = await User.findOne({ email });
  if (existe) return res.status(400).json({ erro: "Usuário já existe" });

  const hash = await bcrypt.hash(senha, 10);

  const user = await User.create({ email, senha: hash });

  res.json(user);
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ erro: "Usuário não encontrado" });

  const ok = await bcrypt.compare(senha, user.senha);
  if (!ok) return res.status(400).json({ erro: "Senha inválida" });

  const token = jwt.sign({ id: user._id }, "segredo");

  res.json({ token });
});

// ===== REGRAS =====

// CRIAR
app.post("/regras", auth, checkDB, async (req, res) => {
  const regra = await Regra.create({
    ...req.body,
    userId: req.userId
  });
  res.json(regra);
});

// LISTAR
app.get("/regras", auth, checkDB, async (req, res) => {
  const regras = await Regra.find({ userId: req.userId });
  res.json(regras);
});

// ===== GERAR MÊS =====
app.get("/mes", auth, checkDB, async (req, res) => {
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
});

// ===== FECHAR MÊS =====
app.post("/fechar", auth, checkDB, async (req, res) => {
  const { mes, dados } = req.body;

  const existe = await Mes.findOne({ mes, userId: req.userId });
  if (existe) return res.status(400).json({ erro: "Mês já fechado" });

  const regras = await Regra.find({ userId: req.userId });

  for (let r of regras) {
    if (r.tipo === "parcelado" && r.ativo) {
      if (r.parcelasPagas < r.totalParcelas) {
        r.parcelasPagas++;
        if (r.parcelasPagas === r.totalParcelas) r.ativo = false;
        await r.save();
      }
    }
  }

  const total = dados.reduce((acc, d) => {
    return d.tipo === "entrada"
      ? acc + d.valor
      : acc - d.valor;
  }, 0);

  await Mes.create({
    userId: req.userId,
    mes,
    dados,
    total
  });

  res.json({ ok: true });
});

// ===== HISTÓRICO =====
app.get("/historico", auth, checkDB, async (req, res) => {
  const meses = await Mes.find({ userId: req.userId }).sort({ mes: -1 });
  res.json(meses);
});

// ===== DELETE =====
app.delete("/regras/:id", auth, checkDB, async (req, res) => {
  await Regra.deleteOne({ _id: req.params.id, userId: req.userId });
  res.json({ ok: true });
});

app.delete("/historico/:id", auth, checkDB, async (req, res) => {
  await Mes.deleteOne({ _id: req.params.id, userId: req.userId });
  res.json({ ok: true });
});

// ===== FRONTEND =====
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== SERVIDOR =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Rodando em http://localhost:" + PORT);
});