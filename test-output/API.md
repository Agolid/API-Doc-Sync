# API Reference

## /pets

### 🔍 GET

List all pets

**Operation ID:** `listPets`

#### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| limit | query | integer | No | How many items to return at one time (max 100) |

#### Responses

**200** - A paged array of pets

**default** - unexpected error

---

### 📝 POST

Create a pet

**Operation ID:** `createPets`

#### Request Body

**Required:** Yes

#### Responses

**201** - Null response

**default** - unexpected error

---

## /pets/{petId}

### 🔍 GET

Info for a specific pet

**Operation ID:** `showPetById`

#### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| petId | path | string | Yes | The id of the pet to retrieve |

#### Responses

**200** - Expected response to a valid request

**default** - unexpected error

---

## /store/order

### 📝 POST

Place an order for a pet

**Operation ID:** `placeOrder`

#### Request Body

**Required:** Yes

#### Responses

**200** - successful operation

**400** - Invalid Order

---

