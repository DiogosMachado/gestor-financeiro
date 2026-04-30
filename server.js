require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

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
const User = mongoose.model("User", {
  email: String,
  senha: String
});

const Regra = mongoose.model("Regra", {
  descricao: String,
  tipo: String,
  valor: Number,
  valorParcela: Number,
  totalParcelas: Number,
  parcelasPagas: Number,
  ativo: Boolean
});

const Mes = mongoose.model("Mes", {
  mes: String,
  dados: Array,
  total: Number
});

// ===== CHECK DB =====
function checkDB(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ erro: "Banco não conectado" });
  }
  next();
}

// ===== TESTE =====
app.get("/teste", (req, res) => {
  res.json({ ok: true });
});

// ===== LOGIN =====
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

    if (user.senha !== senha) {
      return res.status(400).json({ erro: "Senha incorreta" });
    }

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== CRIAR CONTA =====
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

    await User.create({ email, senha });

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== REGRAS =====
app.post("/regras", checkDB, async (req, res) => {
  try {
    const regra = await Regra.create(req.body);
    res.json(regra);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get("/regras", checkDB, async (req, res) => {
  try {
    const regras = await Regra.find();
    res.json(regras);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== GERAR MÊS =====
app.get("/mes", checkDB, async (req, res) => {
  try {
    const regras = await Regra.find();
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

// ===== FECHAR MÊS =====
app.post("/fechar", checkDB, async (req, res) => {
  try {
    const { mes, dados } = req.body;

    const existe = await Mes.findOne({ mes });
    if (existe) {
      return res.status(400).json({ erro: "Mês já fechado" });
    }

    const regras = await Regra.find();

    for (let r of regras) {
      if (r.tipo === "parcelado" && r.ativo) {
        if (r.parcelasPagas < r.totalParcelas) {
          r.parcelasPagas++;

          if (r.parcelasPagas === r.totalParcelas) {
            r.ativo = false;
          }

          await r.save();
        }
      }
    }

    const total = dados.reduce((acc, d) => {
      return d.tipo === "entrada"
        ? acc + d.valor
        : acc - d.valor;
    }, 0);

    await Mes.create({ mes, dados, total });

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== HISTÓRICO =====
app.get("/historico", checkDB, async (req, res) => {
  try {
    const meses = await Mes.find().sort({ mes: -1 });
    res.json(meses);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== DELETE =====
app.delete("/regras/:id", checkDB, async (req, res) => {
  await Regra.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

app.delete("/historico/:id", checkDB, async (req, res) => {
  await Mes.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ===== FRONTEND =====
app.use(express.static(path.join(__dirname, "public")));

// ⚠️ Fallback SEM QUEBRAR API
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== SERVIDOR =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Rodando em http://localhost:" + PORT);
});