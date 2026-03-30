// =============================================
// PEDIDOS / CARRINHO MODULE
// =============================================
let carrinho = [];

const Pedidos = {
  TABLE: AZURE.tables.pedidos,
  PARTITION: 'Pedido',

  async listar() {
    return await TableService.query(this.TABLE);
  },

  async finalizar(dados) {
    if (!carrinho.length) throw new Error('Carrinho vazio');

    const total = carrinho.reduce((s, i) => s + i.Preco * i.qty, 0);
    const rowKey = TableService.generateRowKey();
    const itensStr = carrinho.map(i => `${i.qty}x ${i.Marca} ${i.Modelo}`).join(', ');

    const entity = {
      PartitionKey: this.PARTITION,
      RowKey: rowKey,
      ClienteId: dados.clienteId,
      ClienteNome: dados.clienteNome,
      Itens: itensStr,
      Total: total,
      Pagamento: dados.pagamento,
      Entrega: dados.entrega,
      Status: 'Concluído',
      CriadoEm: new Date().toISOString()
    };

    // Atualiza estoque dos produtos
    for (const item of carrinho) {
      const p = await Produtos.buscarPorId(item.RowKey);
      if (!p) throw new Error(`Produto ${item.Modelo} não encontrado`);
      const novaQtd = parseInt(p.Quantidade) - item.qty;
      if (novaQtd < 0) throw new Error(`Estoque insuficiente para ${item.Modelo}`);
      await Produtos.atualizar(item.RowKey, { ...p, quantidade: novaQtd }, null);
    }

    await TableService.insert(this.TABLE, entity);
    return entity;
  }
};

// =============================================
// PEDIDOS UI
// =============================================
const PedidosUI = {
  adicionarAoCarrinho(produto) {
    const existente = carrinho.find(i => i.RowKey === produto.RowKey);
    if (existente) {
      if (existente.qty >= produto.Quantidade) {
        showToast('Estoque insuficiente', 'error'); return;
      }
      existente.qty++;
    } else {
      if (produto.Quantidade < 1) { showToast('Produto sem estoque', 'error'); return; }
      carrinho.push({ ...produto, qty: 1 });
    }
    this.atualizarBadge();
    showToast(`${produto.Modelo} adicionado ao carrinho!`);
  },

  removerDoCarrinho(rowKey) {
    carrinho = carrinho.filter(i => i.RowKey !== rowKey);
    this.renderCarrinho();
    this.atualizarBadge();
  },

  alterarQtd(rowKey, delta) {
    const item = carrinho.find(i => i.RowKey === rowKey);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) { this.removerDoCarrinho(rowKey); return; }
    if (item.qty > item.Quantidade) { item.qty = item.Quantidade; showToast('Limite de estoque atingido', 'error'); }
    this.renderCarrinho();
  },

  atualizarBadge() {
    const badge = document.getElementById('carrinho-badge');
    const total = carrinho.reduce((s, i) => s + i.qty, 0);
    if (badge) { badge.textContent = total; badge.style.display = total ? 'flex' : 'none'; }
  },

  abrirCarrinho() {
    this.renderCarrinho();
    document.getElementById('modal-carrinho').classList.add('active');
  },

  fecharCarrinho() {
    document.getElementById('modal-carrinho').classList.remove('active');
  },

  renderCarrinho() {
    const lista = document.getElementById('carrinho-lista');
    const totalEl = document.getElementById('carrinho-total');
    if (!lista) return;

    if (!carrinho.length) {
      lista.innerHTML = '<div class="empty">Carrinho vazio.</div>';
      if (totalEl) totalEl.textContent = formatCurrency(0);
      return;
    }

    lista.innerHTML = carrinho.map(item => `
      <div class="carrinho-item">
        <img src="${item.FotoUrl || ''}" onerror="this.style.display='none'" alt="">
        <div class="carrinho-item-info">
          <strong>${item.Marca} ${item.Modelo}</strong>
          <span>${formatCurrency(item.Preco)} × ${item.qty} = ${formatCurrency(item.Preco * item.qty)}</span>
        </div>
        <div class="carrinho-item-qtd">
          <button onclick="PedidosUI.alterarQtd('${item.RowKey}', -1)">−</button>
          <span>${item.qty}</span>
          <button onclick="PedidosUI.alterarQtd('${item.RowKey}', 1)">+</button>
        </div>
        <button class="btn btn-sm btn-danger" onclick="PedidosUI.removerDoCarrinho('${item.RowKey}')">✕</button>
      </div>`).join('');

    const total = carrinho.reduce((s, i) => s + i.Preco * i.qty, 0);
    if (totalEl) totalEl.textContent = formatCurrency(total);
  },

  abrirCheckout() {
    if (!carrinho.length) { showToast('Adicione produtos ao carrinho', 'error'); return; }
    this.fecharCarrinho();
    this.renderResumoCheckout();
    this.carregarClientesSelect();
    document.getElementById('modal-checkout').classList.add('active');
  },

  fecharCheckout() {
    document.getElementById('modal-checkout').classList.remove('active');
  },

  renderResumoCheckout() {
    const el = document.getElementById('checkout-resumo');
    if (!el) return;
    const total = carrinho.reduce((s, i) => s + i.Preco * i.qty, 0);
    el.innerHTML = `
      <div class="resumo-itens">
        ${carrinho.map(i => `<div class="resumo-linha"><span>${i.qty}× ${i.Marca} ${i.Modelo}</span><span>${formatCurrency(i.Preco * i.qty)}</span></div>`).join('')}
      </div>
      <div class="resumo-total"><strong>Total:</strong> <strong>${formatCurrency(total)}</strong></div>`;
  },

  async carregarClientesSelect() {
    const sel = document.getElementById('checkout-cliente');
    if (!sel) return;
    sel.innerHTML = '<option value="">Carregando...</option>';
    try {
      const lista = await Clientes.listar();
      sel.innerHTML = '<option value="">Selecione o cliente</option>' +
        lista.map(c => `<option value="${c.RowKey}" data-nome="${c.Nome}">${c.Nome} — ${c.Email}</option>`).join('');
    } catch (e) {
      sel.innerHTML = '<option value="">Erro ao carregar clientes</option>';
    }
  },

  async finalizar() {
    const btn = document.getElementById('btn-finalizar');
    const clienteSel = document.getElementById('checkout-cliente');
    const pagamento = document.getElementById('checkout-pagamento').value;
    const entrega = document.getElementById('checkout-entrega').value;

    if (!clienteSel.value) { showToast('Selecione um cliente', 'error'); return; }
    if (!pagamento) { showToast('Selecione forma de pagamento', 'error'); return; }
    if (!entrega) { showToast('Selecione forma de entrega', 'error'); return; }

    const clienteNome = clienteSel.options[clienteSel.selectedIndex].dataset.nome;
    const total = carrinho.reduce((s, i) => s + i.Preco * i.qty, 0);

    // Validação de valor e quantidade
    if (total <= 0) { showToast('Valor inválido', 'error'); return; }
    for (const item of carrinho) {
      if (item.qty <= 0 || item.Preco <= 0) { showToast(`Dados inválidos: ${item.Modelo}`, 'error'); return; }
    }

    showLoading(btn, 'Finalizando...');
    try {
      await Pedidos.finalizar({ clienteId: clienteSel.value, clienteNome, pagamento, entrega });
      carrinho = [];
      this.atualizarBadge();
      this.fecharCheckout();
      showToast('Pedido finalizado com sucesso! 🎉');
      await ProdutosUI.carregar();
      await PedidosUI.carregarLista();
    } catch (e) {
      showToast(`Erro: ${e.message}`, 'error');
    } finally { hideLoading(btn); }
  },

  async carregarLista() {
    const tbody = document.getElementById('pedidos-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Carregando...</td></tr>';
    try {
      const lista = await Pedidos.listar();
      if (!lista.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Nenhum pedido.</td></tr>'; return; }
      tbody.innerHTML = lista.map(p => `
        <tr>
          <td>${formatDate(p.CriadoEm)}</td>
          <td><strong>${p.ClienteNome}</strong></td>
          <td>${p.Itens}</td>
          <td>${formatCurrency(p.Total)}</td>
          <td>${p.Pagamento}</td>
          <td>${p.Entrega}</td>
          <td><span class="badge badge-success">${p.Status}</span></td>
        </tr>`).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="error">Erro: ${e.message}</td></tr>`;
    }
  }
};