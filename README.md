# RCS — Continental Racing Series

Projeto completo da **RCS — Continental Racing Series**, preparado para GitHub + Render.

## ⚠️ IMPORTANTE — estrutura correta

Não mova `index.html` ou `admin.html` para a raiz do repositório.

A estrutura precisa ficar **exatamente** assim:

```text
RCS-Continental-Racing-Series/
├── public/
│   ├── index.html
│   └── admin.html
├── server.js
├── package.json
├── render.yaml
├── README.md
└── .gitignore
```

Se você estiver usando o GitHub pelo celular, crie a pasta `public` e coloque os dois arquivos HTML dentro dela antes de fazer o deploy.

## O que já está incluído

- Site público da RCS
- Interface preta/laranja
- Classificação
- Calendário
- Resultados
- Museu / Hall of Fame
- Histórico de vitórias
- Painel administrativo
- Login com JWT
- Senha protegida com bcrypt
- Cadastro de equipes
- Cadastro de pilotos
- Cadastro de corridas
- Cadastro de resultados
- Cálculo automático de pontos, vitórias e pódios
- Banco SQLite
- Endpoint `/health`
- Configuração para Render

## Login do administrador

Usuário inicial:

`admin`

A senha deve ser definida pela variável de ambiente `RCS_ADMIN_PASSWORD` no Render.

Se ela não for definida no primeiro boot, o sistema usa temporariamente:

`rcs123`

**Recomendado:** defina `RCS_ADMIN_PASSWORD` antes do primeiro deploy.

## Deploy no Render

O `render.yaml` já contém a configuração básica.

Build Command:

`npm install`

Start Command:

`npm start`

Health Check:

`/health`

Variáveis utilizadas:

- `JWT_SECRET` — gerada pelo Render
- `RCS_ADMIN_PASSWORD` — senha escolhida por você
- `RCS_DATA_DIR` — `/var/data`

O projeto está configurado para usar um disco persistente em `/var/data`, necessário para manter o banco SQLite entre recriações da aplicação.

## Depois do deploy

Site:

`https://SEU-ENDERECO.onrender.com/`

Painel:

`https://SEU-ENDERECO.onrender.com/admin.html`

**Não abra `admin.html` diretamente pelo gerenciador de arquivos do celular** (`content://` ou `file://`). O painel precisa ser servido pelo Node para conseguir acessar `/api/login`.

## Teste local

Com Node.js 20 ou superior:

```bash
npm install
npm start
```

Depois acesse:

`http://localhost:3000/`

Painel:

`http://localhost:3000/admin.html`
