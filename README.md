# Saffron & Sage — Catering Order System

A fullstack catering ordering app using a JSON database.

## Roles

There are only **two roles**:

### Admin
The admin manages client orders from start to finish:

1. **Pending** — new client order
2. **Confirmed** — admin accepts the order
3. **Preparing** — kitchen is preparing it
4. **Ready** — order is ready for delivery
5. **Delivered** — admin confirms it has been delivered
6. **Client received** — the client confirms receipt on their side

The admin can see all client orders and move each order one step at a time.  
There is **no account/user list** in the admin dashboard.

### Client
The client can:

- Browse the catering menu
- Choose menu items and quantities
- Enter event details
- Place an order
- Track their own order status
- Cancel a pending order
- Confirm the order after it is delivered

Clients cannot change order statuses and cannot access the admin order board.

## Run it

```bash
npm install
npm start
```

Open: `http://localhost:3000`

### Admin demo account

- Email: `admin@saffronsage.test`
- Password: `butter-thyme`

New registrations are always **client** accounts.

## Order API

### Client
- `GET /api/menu`
- `GET /api/orders`
- `POST /api/orders`
- `PATCH /api/orders/:id/cancel`
- `PATCH /api/orders/:id/confirm-received`

### Admin
- `GET /api/admin/stats`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/:id/status`

All protected routes require the bearer token returned by login.
