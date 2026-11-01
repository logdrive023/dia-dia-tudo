# Tudo · ecossistema de gerenciamento

Cabelo (compra, triagem, separação, estoque em gramas, venda pela tabela medida × comprador), salão (agenda, equipe,
organograma, unidades), empréstimos, produtos e modalidades novas montadas pela tela. Português e espanhol.
Funciona sem internet; hoje os dados ficam no aparelho e o sistema está pronto para uma API.

```bash
npm install
npm run dev     # abre em http://localhost:5173
npm test        # regras, contrato local × API, telas
npm run build   # produção (PWA)
```

- Documentação completa, regras, arquitetura e gaps: [SISTEMA.md](SISTEMA.md)
- Desenho inicial e pesquisa de mercado do cabelo: [DESENHO.md](DESENHO.md)
- Contrato da API: [api-contract/openapi.yaml](api-contract/openapi.yaml)
- Deploy automático no GitHub Pages: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
