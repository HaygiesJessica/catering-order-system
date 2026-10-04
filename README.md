# Cai-nan Feast — Catering Order Desk

> *Where Every Order Becomes a Feast.*

A full-stack catering order system with a Filipino *handaan* heart — clients order feasts, the kitchen manages them, and both sides chat in real time. All data is stored in a simple JSON file. 

---

## **Features**

**Client side**

* Sign in (scrypt-hashed passwords, token sessions)
* Browse a Filipino menu by category, with dish photos (letter-tile fallback)
* Basket with steppers, 12% service charge, delivery fee (FREE over ₱5,000)
* **Map-pin delivery location** (Google tiles via Leaflet) with auto-filled address
* Order timeline: `pending → confirmed → preparing → ready → delivered → completed`
* **Cancel** while *pending* or *confirmed*
* **Confirm pickup ✓** once delivered, to close the order
* Notification sounds + chat alerts

**Admin side**

* Order board with live stats (pending, in progress, delivered, revenue, guests fed)
* Tabs: **Client orders / Menu availability / Accounts**
* Orders **grouped by date** (event date or order date) — *first order, first serve*
* Status filter (by group, by status)
* Move tickets down the line: `pending → confirmed → preparing → ready → delivered`
* **Cannot accommodate** to close orders the kitchen can't take
* Toggle any dish **Available / Not available** (reflects instantly on the client side)
* Closed orders (*completed / cancelled / cannot accommodate*) are greyed out & locked

**Chat & notifications**

* Client ↔ admin chat with date dividers, timestamps, and delivered ✓✓ ticks
* Unread **red badge + buzz** on the chat button
* Different sounds: chat blip · client status chime · admin new-order ding

Clients cannot change order statuses and cannot access the admin order board.

---

## **Order lifecycle**

1. **Pending** — new client order
2. **Confirmed** — admin accepts the order
3. **Preparing** — kitchen is preparing it
4. **Ready** — order is ready for delivery
5. **Delivered** — admin confirms delivery
6. **Completed** — client confirms receipt on their side

The admin can move each order one step at a time.

---

## **Tech Stack**

| **Layer** | **Tech**                                       |
| --------- | ---------------------------------------------- |
| Frontend  | Vanilla HTML / CSS / JS (OOP classes), Leaflet |
| Backend   | Node.js + Express (OOP services)               |
| Storage   | A single JSON file — `server/data/db.json`     |

---

## **Getting started**

**Prerequisite:** Node.js 18+

```bash
npm install
npm run dev
```
