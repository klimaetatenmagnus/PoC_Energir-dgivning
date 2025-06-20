// services/subsidy-service/index.js
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// For demo/PoC: stub som returnerer Enova-støtte basert på tiltak-navn
// Senere bytter vi ut stub med kall til ekte Enova-API
app.get("/subsidy", (req, res) => {
  const tiltak = req.query.tiltak || "";
  // En enkel stub-logikk:
  const støtteMap = {
    Loftisolering: 10000,
    // Legg til flere tiltak her om ønskelig
  };
  res.json({
    tiltak,
    enova_støtte_kr: støtteMap[tiltak] || 0,
  });
});

const port = process.env.PORT || 4001;
app.listen(port, () =>
  console.log(`subsidy-service kjører på http://localhost:${port}`)
);
