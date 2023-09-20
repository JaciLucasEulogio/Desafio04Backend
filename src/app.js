const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const exphbs = require("express-handlebars");
const fs = require("fs").promises;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Define el número de puerto en el que se ejecutará el servidor
const port = process.env.PORT || 3000;

app.engine("handlebars", exphbs());
app.set("view engine", "handlebars");

// Middleware para habilitar el uso de JSON en las solicitudes
app.use(express.json());

// Rutas para productos
const productsRouter = express.Router();
app.use("/api/products", productsRouter);

const productsFile = "products.json";

// Listar todos los productos
productsRouter.get("/:pid", async (req, res) => {
  try {
    const data = await fs.readFile(productsFile, "utf8");
    const products = JSON.parse(data);
    const requestedId = req.params.pid;
    console.log("Datos de productos:", products);
    console.log("ID solicitado:", requestedId);
    const product = products.find((p) => p.id === requestedId);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: "Producto no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error al obtener producto" });
  }
});

// Obtener un productos
productsRouter.get("/", async (req, res) => {
  try {
    const data = await fs.readFile(productsFile, "utf8");
    const products = JSON.parse(data);

    const limit = req.query.limit ? parseInt(req.query.limit) : undefined;

    if (limit && limit > 0) {
      const limitedProducts = products.slice(0, limit);
      res.json(limitedProducts);
    } else {
      res.json(products);
    }
  } catch (error) {
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

function generateProductId(products) {
  const maxId = products.reduce((max, product) => {
    return product.id > max ? product.id : max;
  }, 0);

  let uniqueId;
  let isUnique = false;

  while (!isUnique) {
    uniqueId = maxId + 1;
    isUnique = !products.some((product) => parseInt(product.id) === uniqueId);
  }
  return uniqueId;
}

// Agregar un nuevo producto
productsRouter.post("/", async (req, res) => {
  try {
    const data = await fs.readFile(productsFile, "utf8");
    const products = JSON.parse(data);

    // Genera un nuevo ID único como número
    const newProductId = generateProductId(products);

    const newProduct = {
      id: newProductId,
      title: req.body.name, // Cambiar a req.body.name
      description: req.body.description,
      code: req.body.code,
      price: req.body.price, // Cambiar a req.body.price
      status: req.body.status !== undefined ? req.body.status : true,
      stock: req.body.stock,
      category: req.body.category || "",
      thumbnails: req.body.thumbnails || [],
    };

    if (
      newProduct.title &&
      newProduct.description &&
      newProduct.code &&
      newProduct.price && // Debes asegurarte de que se obtenga correctamente el precio desde req.body.price
      newProduct.stock
    ) {
      products.push(newProduct);
      await fs.writeFile(
        productsFile,
        JSON.stringify(products, null, 2),
        "utf8"
      );

      // Emitir un evento WebSocket para notificar la adición del producto
      io.emit("productAdded", newProduct);

      res.json(newProduct);
    } else {
      res.status(400).json({ error: "Faltan campos obligatorios" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error al agregar producto" });
  }
});

// Actualizar un producto por ID
productsRouter.put("/:pid", async (req, res) => {
  try {
    const data = await fs.readFile(productsFile, "utf8");
    const products = JSON.parse(data);
    const productIndex = products.findIndex((p) => p.id === req.params.pid);
    if (productIndex !== -1) {
      const updatedProduct = { ...products[productIndex], ...req.body };

      updatedProduct.id = req.params.pid;

      products[productIndex] = updatedProduct;
      await fs.writeFile(
        productsFile,
        JSON.stringify(products, null, 2),
        "utf8"
      );

      // Emitir un evento WebSocket para notificar la actualización del producto
      io.emit("productUpdated", updatedProduct);

      res.json(updatedProduct);
    } else {
      res.status(404).json({ error: "Producto no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

app.get("/", async (req, res) => {
  try {
    const data = await fs.readFile(productsFile, "utf8");
    const products = JSON.parse(data);

    // Renderiza la vista "home.handlebars" y pasa los datos de los productos
    res.render("home", { products });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

app.get("/realtimeproducts", async (req, res) => {
  try {
    const data = await fs.readFile(productsFile, "utf8");
    const products = JSON.parse(data);

    // Renderiza la vista "realTimeProducts.handlebars" y pasa los datos de los productos
    res.render("realTimeProducts", { products });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al obtener productos en tiempo real" });
  }
});

// Conexión WebSocket
io.on("connection", (socket) => {
  console.log("Cliente conectado");

  socket.on("addProduct", async (productData) => {
    try {
      console.log(productData);
      // Lee la lista actual de productos desde el archivo
      const data = await fs.readFile(productsFile, "utf8");
      const products = JSON.parse(data);

      // Genera un nuevo ID para el producto (puedes usar la misma lógica que tenías)
      const newProductId = generateProductId(products);

      // Crea el nuevo producto
      const newProduct = {
        id: newProductId,
        title: productData.name,
        description: productData.description,
        price: productData.price,
      };

      // Agrega el nuevo producto a la lista
      products.push(newProduct);

      // Escribe la lista actualizada de productos en el archivo
      await fs.writeFile(
        productsFile,
        JSON.stringify(products, null, 2),
        "utf8"
      );

      // Emitir un evento WebSocket para notificar a todos los clientes sobre la adición del producto
      io.emit("productAdded", newProduct);
    } catch (error) {
      console.error("Error al agregar producto:", error);
    }
  });
});

server.listen(port, () => {
  console.log(`Servidor Express en funcionamiento en el puerto ${port}`);
});
