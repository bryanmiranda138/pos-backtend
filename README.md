# 🛒 POS & Inventory System — Backend API (PERN Stack)

API RESTful robusta y segura construida para la gestión integral de un **Punto de Venta (POS) y Control de Inventario**. Desarrollada con **Node.js, Express, Prisma ORM 7 y PostgreSQL**, diseñada para garantizar la integridad transaccional del dinero y el stock en tiempo real.

---

## Características Principales

*  **Autenticación y Autorización por Roles (JWT & Bcrypt):**
  * Control estricto mediante *JSON Web Tokens*.
  * **Rol Administrador (`admin`):** Acceso total al CRUD de inventario, historial y apertura/cierre de caja.
  * **Rol Vendedor (`vendedor`):** Acceso restringido al Punto de Venta e Historial (las rutas de modificación de inventario están protegidas mediante *Middlewares* de backend).
*  **Integridad Transaccional (ACID):**
  * Uso de **Transacciones de Prisma/SQL** al procesar ventas para garantizar que el registro del cobro y el descuento del stock ocurran de manera simultánea e indisoluble.
*  **Control de Flujo de Caja (Arqueo de Turno):**
  * Gestión de sesiones de caja (`caja_sesiones`) con saldo base inicial.
  * Cálculo en tiempo real del dinero esperado (Fondo Inicial + Ventas en Efectivo vs. Tarjeta) para el cierre y arqueo de gaveta.
*  **Historial Detallado de Ventas:**
  * Registro relacional de transacciones con desglose de artículos (`detalle_ventas`), método de pago y cajero responsable.

---

## Stack Tecnológico

* **Runtime:** Node.js
* **Framework:** Express.js
* **Base de Datos:** PostgreSQL (Hospedada en [Supabase](https://supabase.com/))
* **ORM:** Prisma ORM v7 (con adaptador nativo `@prisma/adapter-pg` y librería `pg`)
* **Seguridad:** `jsonwebtoken` (JWT), `bcrypt` (Encriptación de contraseñas), `cors`
* **Despliegue:** [Render](https://render.com/)

---

## Endpoints Principales de la API

| Método | Endpoint | Descripción | Acceso Permitido |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Autentica al usuario y devuelve el token JWT con su rol. | Público |
| `GET` | `/api/productos` | Obtiene el catálogo de productos activos. | Admin / Vendedor |
| `POST` | `/api/productos` | Crea un nuevo artículo en el inventario. | 🔒 Solo Admin |
| `PUT` | `/api/productos/:id` | Actualiza precio, stock o datos de un producto. | 🔒 Solo Admin |
| `DELETE`| `/api/productos/:id` | Elimina un artículo del inventario. | 🔒 Solo Admin |
| `POST` | `/api/caja/abrir` | Inicia un turno de caja con un saldo base inicial. | Admin / Vendedor |
| `GET` | `/api/caja/resumen`| Devuelve los totales calculados para el arqueo previo al cierre. | Admin / Vendedor |
| `PUT` | `/api/caja/cerrar` | Cierra la sesión de caja activa. | Admin / Vendedor |
| `POST` | `/api/ventas` | Procesa el cobro, registra el ticket y descuenta stock en transacción. | Admin / Vendedor |
| `GET` | `/api/ventas` | Obtiene el historial completo de ventas con sus detalles relacionales. | Admin / Vendedor |

---

##  Instalación y Configuración Local

1. **Clonar el repositorio:**
   ```bash
   git clone [https://github.com/tu-usuario/pos-backend.git](https://github.com/tu-usuario/pos-backend.git)
   cd pos-backend
