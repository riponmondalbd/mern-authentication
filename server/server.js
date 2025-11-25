import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({ credentials: true }));

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.listen(port, () => console.log(`Server is running on PORT:${port}`));
