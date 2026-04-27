require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// ===== CONEXÃO MONGO =====
mongoose.connect(
  process.env.MONGO_URL || "mongodb://127.0.0.1:27017/financas"
)
.then(() => console.log("🔥 Mongo conectado"))
.catch(err => console.log("❌ Erro Mongo:", err));

// ===== MODELS =====
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

// ===== ROTAS =====

// Criar regra
app.post("/regras", async (req, res) => {
  try {
    const regra = await Regra.create(req.body);
    res.json(regra);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Listar regras
app.get("/regras", async (req, res) => {
  const regras = await Regra.find();
  res.json(regras);
});

// ===== GERAR MÊS =====
app.get("/mes", async (req, res) => {
  const regras = await Regra.find();

  let lista = [];

  regras.forEach(r => {
    if (!r.ativo) return;

    // 🔥 ENTRADA + FIXO + VARIÁVEL
    if (["fixo", "variavel", "entrada"].includes(r.tipo)) {
      lista.push({
        _id: r._id,
        desc: r.descricao,
        valor: r.valor,
        tipo: r.tipo
      });
    }

    // 🔥 PARCELADO
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
app.post("/fechar", async (req, res) => {
  try {
    const { mes, dados } = req.body;

    if (!dados || !Array.isArray(dados)) {
      return res.status(400).json({ erro: "Dados inválidos" });
    }

    // 🔥 EVITA DUPLICAR MÊS
    const existe = await Mes.findOne({ mes });
    if (existe) {
      return res.status(400).json({ erro: "Mês já fechado" });
    }

    // 🔥 ATUALIZA PARCELAS
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

    // 🔥 CALCULA TOTAL (AGORA COM ENTRADA)
    const total = dados.reduce((acc, d) => {
      if (d.tipo === "entrada") return acc + d.valor;
      return acc - d.valor;
    }, 0);

    await Mes.create({
      mes,
      dados,
      total
    });

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== HISTÓRICO =====
app.get("/historico", async (req, res) => {
  const meses = await Mes.find().sort({ mes: -1 });
  res.json(meses);
});

// ===== DELETAR REGRA =====
app.delete("/regras/:id", async (req, res) => {
  await Regra.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ===== DELETAR MÊS =====
app.delete("/historico/:id", async (req, res) => {
  await Mes.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ===== FRONTEND =====
app.use(express.static(path.join(__dirname, "public")));

// ===== SERVIDOR =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Servidor rodando na porta", PORT);
});