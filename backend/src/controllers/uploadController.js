import supabase from "../config/supabaseClient.js";
import { PDFParse } from "pdf-parse";

export const uploadFile = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Upload to Supabase Storage
    const fileName = `${Date.now()}-${file.originalname}`;

    const { data, error } = await supabase.storage
      .from("course-files")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("course-files")
      .getPublicUrl(fileName);

    // Extract text if PDF
    let extractedText = null;
    if (file.mimetype === "application/pdf") {
      try {
        const parsed = await new PDFParse({ data: file.buffer }).getText();
        extractedText = parsed.text;
      } catch (parseError) {
        console.error("PDF parse error:", parseError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      url: urlData.publicUrl,
      path: fileName,
      extractedText,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};