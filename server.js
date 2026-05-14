require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

// ===============================
// CONFIG
// ===============================

const PORT = process.env.PORT || 3000;

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// ===============================
// DEBUG
// ===============================

console.log("🔥 MONGO_URL:", process.env.MONGO_URL);

// ===============================
// MONGO
// ===============================

if (!process.env.MONGO_URL) {
  console.log("❌ MONGO_URL não encontrada");
}

mongoose.connect(process.env.MONGO_URL)

  .then(() => {
    console.log("✅ Mongo conectado");
  })

  .catch((err) => {
    console.log("❌ Erro Mongo:", err.message);
  });

// ===============================
// MODELS
// ===============================

const RegraSchema = new mongoose.Schema({

  descricao: {
    type: String,
    required: true
  },

  tipo: {
    type: String,
    required: true
  },

  valor: {
    type: Number,
    required: true
  },

  parcelas: {
    type: Number,
    default: 0
  }

});

const MesSchema = new mongoose.Schema({

  mes: String,

  dados: Array,

  total: Number

});

const Regra = mongoose.model("Regra", RegraSchema);

const Mes = mongoose.model("Mes", MesSchema);

// ===============================
// TESTE
// ===============================

app.get("/teste", (req, res) => {

  res.json({
    ok: true
  });

});

// ===============================
// REGRAS
// ===============================

// ADICIONAR

app.post("/regras", async (req, res) => {

  try {

    const {
      descricao,
      tipo,
      valor,
      parcelas
    } = req.body;

    if (!descricao || !tipo || !valor) {

      return res.status(400).json({
        erro: "Dados inválidos"
      });

    }

    const novaRegra = await Regra.create({

      descricao,

      tipo,

      valor,

      parcelas: parcelas || 0

    });

    res.json(novaRegra);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      erro: "Erro ao salvar"
    });

  }

});

// LISTAR

app.get("/regras", async (req, res) => {

  try {

    const regras = await Regra.find().sort({
      _id: -1
    });

    res.json(regras);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      erro: "Erro ao buscar"
    });

  }

});

// DELETAR

app.delete("/regras/:id", async (req, res) => {

  try {

    await Regra.findByIdAndDelete(req.params.id);

    res.json({
      ok: true
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      erro: "Erro ao deletar"
    });

  }

});

// ===============================
// FECHAR MÊS
// ===============================

app.post("/fechar", async (req, res) => {

  try {

    const {
      mes,
      dados
    } = req.body;

    const total = dados.reduce((acc, item) => {

      if (item.tipo === "entrada") {
        return acc + Number(item.valor);
      }

      return acc - Number(item.valor);

    }, 0);

    const existe = await Mes.findOne({ mes });

    if (existe) {

      return res.status(400).json({
        erro: "Mês já fechado"
      });

    }

    const novoMes = await Mes.create({

      mes,

      dados,

      total

    });

    res.json(novoMes);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      erro: "Erro ao fechar mês"
    });

  }

});

// ===============================
// HISTORICO
// ===============================

// LISTAR

app.get("/historico", async (req, res) => {

  try {

    const meses = await Mes.find().sort({
      mes: -1
    });

    res.json(meses);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      erro: "Erro histórico"
    });

  }

});

// DELETAR

app.delete("/historico/:id", async (req, res) => {

  try {

    await Mes.findByIdAndDelete(req.params.id);

    res.json({
      ok: true
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      erro: "Erro ao deletar mês"
    });

  }

});

// ===============================
// FRONTEND
// ===============================

app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );

});

// ===============================
// 404
// ===============================

app.use((req, res) => {

  res.status(404).json({
    erro: "Rota não encontrada"
  });

});

// ===============================
// SERVER
// ===============================

app.listen(PORT, () => {

  console.log(`🚀 Rodando na porta ${PORT}`);

});