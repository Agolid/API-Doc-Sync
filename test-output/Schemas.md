# Data Schemas

## Pet

**Type:** object

### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | integer | Yes | Unique identifier for the pet |
| name | string | Yes | Name of the pet |
| tag | string | No | Tag for the pet |

---

## NewPet

**Type:** object

### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Name of the pet |
| tag | string | No | Tag for the pet |

---

## Error

**Type:** object

### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| code | integer | Yes | Error code |
| message | string | Yes | Error message |

---

## Order

**Type:** object

### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | integer | No | Order ID |
| petId | integer | Yes | Pet ID |
| quantity | integer | Yes | Number of items to order |
| status | string | No | Order status |
| complete | boolean | No | Order completion status |

---

