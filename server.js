const express = require("express"); 
const mongoose = require("mongoose");
const cors = require("cors");

console.log("🔥 SERVER CORRIGIDO RODANDO 🔥");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/financas");

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

// CRIAR REGRA
app.post("/regras", async (req, res) => {
  try {
    const regra = await Regra.create(req.body);
    res.json(regra);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao salvar regra" });
  }
});

// LISTAR REGRAS
app.get("/regras", async (req, res) => {
  const regras = await Regra.find();
  res.json(regras);
});

// GERAR MÊS
app.get("/mes", async (req, res) => {
  const regras = await Regra.find();

  let lista = [];

  regras.forEach(r => {
    if (!r.ativo) return;

    if (r.tipo === "fixo") {
      lista.push({
        _id: r._id,
        desc: r.descricao,
        valor: r.valor,
        tipo: "fixo"
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

// FECHAR MÊS (CORRIGIDO)
app.post("/fechar", async (req, res) => {
  try {
    const { mes, dados } = req.body;

    // 🚫 BLOQUEIA DUPLICAÇÃO
    const existe = await Mes.findOne({ mes });

    if (existe) {
      return res.status(400).json({ erro: "Mês já foi fechado!" });
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

    const total = dados.reduce((acc, d) => acc + d.valor, 0);

    await Mes.create({
      mes,
      dados,
      total
    });

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({ erro: "Erro ao fechar mês" });
  }
});

// LISTAR HISTÓRICO
app.get("/historico", async (req, res) => {
  const meses = await Mes.find().sort({ mes: -1 });
  res.json(meses);
});

// EXCLUIR REGRA
app.delete("/regras/:id", async (req, res) => {
  try {
    const regra = await Regra.findByIdAndDelete(req.params.id);

    if (!regra) {
      return res.status(404).json({ erro: "Regra não encontrada" });
    }

    res.json({ ok: true });

  } catch {
    res.status(500).json({ erro: "Erro ao excluir regra" });
  }
});

// EXCLUIR MÊS (CORRIGIDO)
app.delete("/historico/:id", async (req, res) => {
  try {
    const mes = await Mes.findByIdAndDelete(req.params.id);

    if (!mes) {
      return res.status(404).json({ erro: "Mês não encontrado" });
    }

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({ erro: "Erro ao excluir mês" });
  }
});

const path = require("path");

app.use(express.static(path.join(__dirname, "public")));

// START
app.listen(3000, () => console.log("Servidor rodando na porta 3000"));