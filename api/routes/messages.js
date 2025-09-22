// 📁 routes/messages.js
import express from "express";
import { 
    getAllMessages, 
    updateLuStatus 
} from "../controllers/messages.controller.js";
import verifyAdminToken from "../middlewares/verifyAdminToken.js";

const router = express.Router();
router.get("/", verifyAdminToken, getAllMessages);
router.put("/:id", verifyAdminToken, updateLuStatus);

export default router;
