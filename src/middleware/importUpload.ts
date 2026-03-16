import multer from "multer";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const importMulter = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === XLSX_MIME) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only .xlsx files are accepted. Received: " + file.mimetype
        )
      );
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

export const importUpload = importMulter.single("file");

