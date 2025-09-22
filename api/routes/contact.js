// 📁 routes/contact.js
import express from "express";
import { envoyerMessageContact } from "../controllers/contact.controller.js";

const router = express.Router();

router.post("/", envoyerMessageContact);

export default router;
