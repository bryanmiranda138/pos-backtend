require('dotenv').config(); // <- Carga las variables de entorno
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ==========================================
//  NUEVA CONFIGURACIÓN PARA PRISMA 7
// ==========================================
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// 1. Configuramos el driver nativo de Postgres
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

// 2. Creamos el adaptador de Prisma
const adapter = new PrismaPg(pool);

// 3. Inicializamos Prisma inyectando el adaptador (¡Esto soluciona el error!)
const prisma = new PrismaClient({ adapter });
// ==========================================

const app = express();

// Configurar Middlewares
app.use(cors());
app.use(express.json());

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

// 1. REGISTRO DE USUARIO (Solo para crear tus usuarios de prueba iniciales)
app.post('/api/auth/registro', async (req, res) => {
  try {
    const { nombre, password, rol } = req.body;

    // Encriptar la contraseña antes de guardarla
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const nuevoUsuario = await prisma.usuarios.create({
      data: {
        nombre,
        password_hash,
        rol // 'admin' o 'vendedor'
      },
    });

    res.status(201).json({ mensaje: 'Usuario creado exitosamente', usuario: nuevoUsuario.nombre });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar el usuario' });
  }
});

// 2. LOGIN DE USUARIO
app.post('/api/auth/login', async (req, res) => {
  try {
    const { nombre, password } = req.body;
    // Buscar al usuario en la base de datos
    const usuario = await prisma.usuarios.findFirst({
      where: { nombre: nombre }
    });

    if (!usuario) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    // Comparar la contraseña ingresada con el hash guardado
    const passwordValida = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValida) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    // Generar el JWT incluyendo el ID y el ROL del usuario
    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ mensaje: 'Login exitoso', token, rol: usuario.rol });
  } catch (error) {
    console.error('ERROR DEL SERVIDOR:', error);
    res.status(500).json({ error: 'Error en el servidor al iniciar sesión' });
  }
});

// ==========================================
//  MIDDLEWARES DE SEGURIDAD
// ==========================================

// Verifica que el usuario tenga un token válido
const verificarToken = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Acceso denegado. No hay token.' });

  try {
    // Se espera que el token venga como "Bearer <token>"
    const tokenLimpio = token.split(' ')[1];
    const verificado = jwt.verify(tokenLimpio, process.env.JWT_SECRET);
    req.usuario = verificado; // Guardamos los datos del usuario (id, rol) en la petición
    next(); // Pasa a la siguiente función
  } catch (error) {
    res.status(400).json({ error: 'Token inválido' });
  }
};

// Verifica que el usuario sea administrador
const verificarAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  next();
};

// ==========================================
//  RUTAS DEL CRUD DE PRODUCTOS
// ==========================================

// 1. CREAR un producto (POST)
app.post('/api/productos', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { nombre, descripcion, precio, stock } = req.body;
    const nuevoProducto = await prisma.productos.create({
      data: {
        nombre,
        descripcion,
        precio,
        stock
      },
    });
    res.status(201).json(nuevoProducto);
  } catch (error) {
    res.status(500).json({ error: 'Hubo un error al crear el producto' });
  }
});

// 2. LEER todos los productos (GET)
app.get('/api/productos', verificarToken, async (req, res) => {
  try {
    const productos = await prisma.productos.findMany();
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: 'Hubo un error al obtener los productos' });
  }
});

// 3. ACTUALIZAR un producto (PUT)
app.put('/api/productos/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock } = req.body;

    const productoActualizado = await prisma.productos.update({
      where: { id: parseInt(id) },
      data: { nombre, descripcion, precio, stock },
    });
    res.json(productoActualizado);
  } catch (error) {
    res.status(500).json({ error: 'Hubo un error al actualizar el producto' });
  }
});

// 4. ELIMINAR un producto (DELETE)
app.delete('/api/productos/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.productos.delete({
      where: { id: parseInt(id) },
    });
    res.json({ mensaje: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Hubo un error al eliminar el producto' });
  }
});

// ==========================================
// RUTAS DE CONTROL DE CAJA
// ==========================================

// 1. VERIFICAR EL ESTADO DE LA CAJA (¿Está abierta?)
app.get('/api/caja/estado', verificarToken, async (req, res) => {
  try {
    const sesionActiva = await prisma.caja_sesiones.findFirst({
      where: { usuario_id: req.usuario.id, fecha_cierre: null }
    });
    res.json({ activa: !!sesionActiva, sesion: sesionActiva });
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar la caja' });
  }
});

// 2. ABRIR CAJA
app.post('/api/caja/abrir', verificarToken, async (req, res) => {
  try {
    const { saldo_inicial } = req.body;

    // Verificar si ya hay una caja abierta para no abrir dos
    const existente = await prisma.caja_sesiones.findFirst({
      where: { usuario_id: req.usuario.id, fecha_cierre: null }
    });

    if (existente) return res.status(400).json({ error: 'Ya tienes una caja abierta' });

    const nuevaSesion = await prisma.caja_sesiones.create({
      data: {
        usuario_id: req.usuario.id,
        saldo_inicial: parseFloat(saldo_inicial)
      }
    });
    res.status(201).json({ mensaje: 'Caja abierta con éxito', sesion: nuevaSesion });
  } catch (error) {
    res.status(500).json({ error: 'Error al abrir la caja' });
  }
});

// OBTENER RESUMEN ANTES DE CERRAR (PRE-CIERRE CON DESGLOSE)
app.get('/api/caja/resumen', verificarToken, async (req, res) => {
  try {
    const sesionActiva = await prisma.caja_sesiones.findFirst({
      where: { usuario_id: req.usuario.id, fecha_cierre: null }
    });

    if (!sesionActiva) return res.status(400).json({ error: 'No hay ninguna caja abierta' });

    // 1. Sumamos solo las ventas en EFECTIVO
    const ventasEfectivo = await prisma.ventas.aggregate({
      where: { sesion_caja_id: sesionActiva.id, metodo_pago: 'efectivo' },
      _sum: { total: true }
    });

    // 2. Sumamos solo las ventas con TARJETA
    const ventasTarjeta = await prisma.ventas.aggregate({
      where: { sesion_caja_id: sesionActiva.id, metodo_pago: 'tarjeta' },
      _sum: { total: true }
    });
    
    const totalEfectivo = parseFloat(ventasEfectivo._sum.total || 0);
    const totalTarjeta = parseFloat(ventasTarjeta._sum.total || 0);
    const totalVendido = totalEfectivo + totalTarjeta;
    
    const saldoInicial = parseFloat(sesionActiva.saldo_inicial);
    const saldoEsperado = saldoInicial + totalVendido;

    res.json({
      saldoInicial,
      totalVendido,
      totalEfectivo,
      totalTarjeta,
      saldoEsperado
    });
  } catch (error) {
    console.error('Error en /caja/resumen:', error);
    res.status(500).json({ error: 'Error al calcular el resumen de la caja' });
  }
});

// 3. CERRAR CAJA
app.put('/api/caja/cerrar', verificarToken, async (req, res) => {
  try {
    const sesionActiva = await prisma.caja_sesiones.findFirst({
      where: { usuario_id: req.usuario.id, fecha_cierre: null }
    });

    if (!sesionActiva) return res.status(400).json({ error: 'No hay ninguna caja abierta' });

    // Sumar todas las ventas hechas durante esta sesión
    const ventas = await prisma.ventas.aggregate({
      where: { sesion_caja_id: sesionActiva.id },
      _sum: { total: true }
    });

    const totalVendido = ventas._sum.total || 0;
    const saldoFinal = parseFloat(sesionActiva.saldo_inicial) + parseFloat(totalVendido);

    // Actualizar la sesión poniéndole fecha de cierre y el dinero final
    const sesionCerrada = await prisma.caja_sesiones.update({
      where: { id: sesionActiva.id },
      data: {
        fecha_cierre: new Date(),
        saldo_final: saldoFinal
      }
    });

    res.json({ mensaje: 'Caja cerrada correctamente', totalVendido, saldoFinal });
  } catch (error) {
    res.status(500).json({ error: 'Error al cerrar la caja' });
  }
});

// ==========================================
// RUTAS DEL PUNTO DE VENTA
// ==========================================

// PROCESAR UNA VENTA (POST) - Accesible para Admin y Vendedores
app.post('/api/ventas', verificarToken, async (req, res) => {
  try {
    const { total, metodo_pago, carrito } = req.body;

    // ¡NUEVO!: Verificamos que el cajero tenga una caja abierta
    const sesionCaja = await prisma.caja_sesiones.findFirst({
      where: { usuario_id: req.usuario.id, fecha_cierre: null }
    });

    if (!sesionCaja) {
      return res.status(400).json({ error: 'Debes abrir la caja antes de poder vender.' });
    }

    const nuevaVenta = await prisma.$transaction(async (tx) => {
      // 1. Crear la venta vinculada a la sesión de caja
      const venta = await tx.ventas.create({
        data: {
          total: parseFloat(total),
          metodo_pago,
          sesion_caja_id: sesionCaja.id // Vinculamos la venta a la caja del día
        }
      });

      // 2. Guardar detalles y descontar stock
      for (const item of carrito) {
        await tx.detalle_ventas.create({
          data: {
            venta_id: venta.id,
            producto_id: item.id,
            cantidad: item.cantidad,
            precio_unitario: parseFloat(item.precio)
          }
        });

        await tx.productos.update({
          where: { id: item.id },
          data: { stock: { decrement: item.cantidad } }
        });
      }
      return venta;
    });

    res.status(201).json({ mensaje: 'Venta procesada con éxito', venta: nuevaVenta });
  } catch (error) {
    console.error('Error al procesar la venta:', error);
    res.status(500).json({ error: 'Hubo un error al procesar la venta' });
  }
});

// ========================================//
// RUTAS DE HISTORIAL (REPORTES)           //
// ========================================//

// OBTENER HISTORIAL DE VENTAS (GET) - Solo para Admin
app.get('/api/historial/ventas', verificarToken, async (req, res) => {
  try {
    // Usamos Prisma para buscar las ventas y "unir" (include) la información relacionada
    const historialVentas = await prisma.ventas.findMany({
      orderBy: { fecha: 'desc' }, // Ordenar de la más reciente a la más antigua
      include: {
        // Traemos los detalles de la caja y quién era el cajero
        caja_sesiones: {
          include: {
            usuarios: {
              select: { nombre: true } // Solo traemos el nombre del usuario
            }
          }
        },
        // Traemos qué productos específicos se vendieron en esa venta
        detalle_ventas: {
          include: {
            productos: {
              select: { nombre: true } // Solo traemos el nombre del producto
            }
          }
        }
      }
    });

    res.json(historialVentas);
  } catch (error) {
    console.error('Error al obtener el historial:', error);
    res.status(500).json({ error: 'Hubo un error al cargar el historial' });
  }
});

// ==========================================
// INICIAR EL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo exitosamente en http://localhost:${PORT}`);
});