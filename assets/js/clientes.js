// =============================================
// CLIENTES MODULE
// =============================================
const Clientes = {
  TABLE: AZURE.tables.clientes,
  PARTITION: 'Cliente',

  async listar() {
    return await TableService.query(this.TABLE);
  },

  async buscarPorId(rowKey) {
    return await TableService.getOne(this.TABLE, this.PARTITION, rowKey);
  },

  async cadastrar(dados) {
    const rowKey = TableService.generateRowKey();
    const entity = {
      PartitionKey: this.PARTITION,
      RowKey: rowKey,
      Nome: dados.nome,
      Email: dados.email,
      Telefone: dados.telefone || '',
      CPF: dados.cpf || '',
      Endereco: dados.endereco || '',
      Cidade: dados.cidade || '',
      CriadoEm: new Date().toISOString()
    };
    await TableService.insert(this.TABLE, entity);
    return entity;
  },

  async atualizar(rowKey, dados) {
    const atual = await this.buscarPorId(rowKey);
    const entity = {
      PartitionKey: this.PARTITION,
      RowKey: rowKey,
      Nome: dados.nome,
      Email: dados.email,
      Telefone: dados.telefone || '',
      CPF: dados.cpf || '',
      Endereco: dados.endereco || '',
      Cidade: dados.cidade || '',
      CriadoEm: atual.CriadoEm
    };
    await TableService.update(this.TABLE, this.PARTITION, rowKey, entity);
    return entity;
  },

  async excluir(rowKey) {
    await TableService.delete(this.TABLE, this.PARTITION, rowKey);
  },

  renderRow(c) {
    return `
      <tr>
        <td><strong>${c.Nome}</strong></td>
        <td>${c.Email}</td>
        <td>${c.Telefone || '-'}</td>
        <td>${c.CPF || '-'}</td>
        <td>${c.Cidade || '-'}</td>
        <td>${formatDate(c.CriadoEm)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="ClientesUI.editar('${c.RowKey}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="ClientesUI.excluir('${c.RowKey}', '${c.Nome}')">Excluir</button>
          <button class="btn btn-sm btn-ghost" onclick="ClientesUI.verHistorico('${c.RowKey}', '${c.Nome}')">Histórico</button>
        </td>
      </tr>`;
  }
};

// =============================================
// CLIENTES UI
// =============================================
const ClientesUI = {
  async carregar() {
    const tbody = document.getElementById('clientes-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Carregando...</td></tr>';
    try {
      const lista = await Clientes.listar();
      if (!lista.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Nenhum cliente cadastrado.</td></tr>'; return; }
      tbody.innerHTML = lista.map(Clientes.renderRow).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="error">Erro: ${e.message}</td></tr>`;
    }
  },

  abrirModal(cliente = null) {
    document.getElementById('modal-cliente-titulo').textContent = cliente ? 'Editar Cliente' : 'Novo Cliente';
    document.getElementById('cliente-id').value = cliente?.RowKey || '';
    document.getElementById('cliente-nome').value = cliente?.Nome || '';
    document.getElementById('cliente-email').value = cliente?.Email || '';
    document.getElementById('cliente-telefone').value = cliente?.Telefone || '';
    document.getElementById('cliente-cpf').value = cliente?.CPF || '';
    document.getElementById('cliente-endereco').value = cliente?.Endereco || '';
    document.getElementById('cliente-cidade').value = cliente?.Cidade || '';
    document.getElementById('modal-cliente').classList.add('active');
  },

  fecharModal() {
    document.getElementById('modal-cliente').classList.remove('active');
    document.getElementById('form-cliente').reset();
  },

  async editar(rowKey) {
    try {
      const c = await Clientes.buscarPorId(rowKey);
      this.abrirModal(c);
    } catch (e) { showToast('Erro ao carregar cliente', 'error'); }
  },

  async excluir(rowKey, nome) {
    if (!confirm(`Excluir cliente "${nome}"?`)) return;
    try {
      await Clientes.excluir(rowKey);
      showToast('Cliente excluído!');
      this.carregar();
    } catch (e) { showToast('Erro ao excluir', 'error'); }
  },

  async verHistorico(clienteId, nome) {
    const modal = document.getElementById('modal-historico');
    document.getElementById('historico-cliente-nome').textContent = nome;
    document.getElementById('historico-lista').innerHTML = '<div class="loading">Carregando...</div>';
    modal.classList.add('active');
    try {
      const pedidos = await TableService.query(AZURE.tables.pedidos, `ClienteId eq '${clienteId}'`);
      if (!pedidos.length) {
        document.getElementById('historico-lista').innerHTML = '<div class="empty">Nenhum pedido encontrado.</div>';
        return;
      }
      document.getElementById('historico-lista').innerHTML = pedidos.map(p => `
        <div class="historico-item">
          <span class="hist-data">${formatDate(p.CriadoEm)}</span>
          <span class="hist-desc">${p.Itens || 'Pedido'}</span>
          <span class="hist-valor">${formatCurrency(p.Total)}</span>
          <span class="badge badge-${p.Status === 'Concluído' ? 'success' : 'warning'}">${p.Status}</span>
        </div>`).join('');
    } catch (e) {
      document.getElementById('historico-lista').innerHTML = `<div class="error">Erro: ${e.message}</div>`;
    }
  },

  fecharHistorico() {
    document.getElementById('modal-historico').classList.remove('active');
  },

  async salvar() {
    const btn = document.getElementById('btn-salvar-cliente');
    const rowKey = document.getElementById('cliente-id').value;
    const dados = {
      nome: document.getElementById('cliente-nome').value.trim(),
      email: document.getElementById('cliente-email').value.trim(),
      telefone: document.getElementById('cliente-telefone').value.trim(),
      cpf: document.getElementById('cliente-cpf').value.trim(),
      endereco: document.getElementById('cliente-endereco').value.trim(),
      cidade: document.getElementById('cliente-cidade').value.trim()
    };

    if (!dados.nome || !dados.email) {
      showToast('Nome e e-mail são obrigatórios', 'error'); return;
    }

    showLoading(btn, 'Salvando...');
    try {
      if (rowKey) { await Clientes.atualizar(rowKey, dados); showToast('Cliente atualizado!'); }
      else { await Clientes.cadastrar(dados); showToast('Cliente cadastrado!'); }
      this.fecharModal();
      this.carregar();
    } catch (e) {
      showToast(`Erro: ${e.message}`, 'error');
    } finally { hideLoading(btn); }
  }
};