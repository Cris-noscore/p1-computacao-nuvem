// =============================================
// PRODUTOS MODULE
// =============================================
const Produtos = {
  TABLE: AZURE.tables.produtos,
  PARTITION: 'Produto-Cris',

  async listar(filtros = {}) {
    let filter = `PartitionKey eq '${this.PARTITION}'`;
    if (filtros.marca) filter += ` and Marca eq '${filtros.marca}'`;
    if (filtros.modelo) filter += ` and substringof('${filtros.modelo}', Modelo)`;
    if (filtros.precoMin) filter += ` and Preco ge ${filtros.precoMin}`;
    if (filtros.precoMax) filter += ` and Preco le ${filtros.precoMax}`;
    return await TableService.query(this.TABLE, filter);
  },

  async buscarPorId(rowKey) {
    return await TableService.getOne(this.TABLE, this.PARTITION, rowKey);
  },

  async _uploadFoto(arquivo) {
    const blobName = BlobService.generateBlobName(arquivo);
    const baseUrl = await BlobService.uploadImage(AZURE.containers.produtos, blobName, arquivo);
    return `${baseUrl}?${AZURE.sasToken}`;
  },

  async cadastrar(dados, arquivo) {
    const rowKey = TableService.generateRowKey();
    let fotoUrl = '';
    if (arquivo) fotoUrl = await this._uploadFoto(arquivo);

    const entity = {
      PartitionKey: this.PARTITION,
      RowKey: rowKey,
      Marca: dados.marca,
      Modelo: dados.modelo,
      Descricao: dados.descricao || '',
      Preco: parseFloat(dados.preco),
      Quantidade: parseInt(dados.quantidade),
      FotoUrl: fotoUrl,
      CriadoEm: new Date().toISOString()
    };

    await TableService.insert(this.TABLE, entity);
    return entity;
  },

  async atualizar(rowKey, dados, arquivo) {
    const atual = await this.buscarPorId(rowKey);
    let fotoUrl = atual.FotoUrl || '';
    if (arquivo) fotoUrl = await this._uploadFoto(arquivo);

    const entity = {
      PartitionKey: this.PARTITION,
      RowKey: rowKey,
      Marca: dados.marca,
      Modelo: dados.modelo,
      Descricao: dados.descricao || '',
      Preco: parseFloat(dados.preco),
      Quantidade: parseInt(dados.quantidade),
      FotoUrl: fotoUrl,
      CriadoEm: atual.CriadoEm
    };

    await TableService.update(this.TABLE, this.PARTITION, rowKey, entity);
    return entity;
  },

  async excluir(rowKey) {
    await TableService.delete(this.TABLE, this.PARTITION, rowKey);
  },

  renderCard(p) {
    const semFoto = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTJlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+U2VtIGZvdG88L3RleHQ+PC9zdmc+';
    return `
      <div class="card produto-card" data-id="${p.RowKey}">
        <div class="card-img">
          <img src="${p.FotoUrl || semFoto}" alt="${p.Modelo}" onerror="this.src='${semFoto}'">
        </div>
        <div class="card-body">
          <span class="badge">${p.Marca}</span>
          <h3>${p.Modelo}</h3>
          <p class="desc">${p.Descricao || ''}</p>
          <div class="card-footer">
            <span class="preco">${formatCurrency(p.Preco)}</span>
            <span class="estoque ${p.Quantidade > 0 ? 'ok' : 'zero'}">${p.Quantidade} un.</span>
          </div>
          <div class="card-actions">
            <button class="btn btn-sm btn-outline" onclick="ProdutosUI.editar('${p.RowKey}')">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="ProdutosUI.excluir('${p.RowKey}', '${p.Modelo}')">Excluir</button>
            <button class="btn btn-sm btn-primary" onclick="PedidosUI.adicionarAoCarrinho(${JSON.stringify(p).replace(/"/g, '&quot;')})">+ Carrinho</button>
          </div>
        </div>
      </div>`;
  }
};

// =============================================
// PRODUTOS UI
// =============================================
const ProdutosUI = {
  async carregar() {
    const grid = document.getElementById('produtos-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading">Carregando produtos...</div>';
    try {
      const lista = await Produtos.listar();
      if (!lista.length) { grid.innerHTML = '<div class="empty">Nenhum produto cadastrado.</div>'; return; }
      grid.innerHTML = lista.map(Produtos.renderCard).join('');
    } catch (e) {
      grid.innerHTML = `<div class="error">Erro ao carregar: ${e.message}</div>`;
    }
  },

  async filtrar() {
    const grid = document.getElementById('produtos-grid');
    grid.innerHTML = '<div class="loading">Filtrando...</div>';
    const filtros = {
      marca: document.getElementById('filtro-marca')?.value.trim(),
      modelo: document.getElementById('filtro-modelo')?.value.trim(),
      precoMin: document.getElementById('filtro-preco-min')?.value,
      precoMax: document.getElementById('filtro-preco-max')?.value
    };
    try {
      const lista = await Produtos.listar(filtros);
      if (!lista.length) { grid.innerHTML = '<div class="empty">Nenhum produto encontrado.</div>'; return; }
      grid.innerHTML = lista.map(Produtos.renderCard).join('');
    } catch (e) {
      grid.innerHTML = `<div class="error">Erro: ${e.message}</div>`;
    }
  },

  abrirModal(produto = null) {
    document.getElementById('modal-produto-titulo').textContent = produto ? 'Editar Produto' : 'Novo Produto';
    document.getElementById('produto-id').value = produto?.RowKey || '';
    document.getElementById('produto-marca').value = produto?.Marca || '';
    document.getElementById('produto-modelo').value = produto?.Modelo || '';
    document.getElementById('produto-descricao').value = produto?.Descricao || '';
    document.getElementById('produto-preco').value = produto?.Preco || '';
    document.getElementById('produto-quantidade').value = produto?.Quantidade || '';
    document.getElementById('produto-foto-preview').src = produto?.FotoUrl || '';
    document.getElementById('produto-foto-preview').style.display = produto?.FotoUrl ? 'block' : 'none';
    document.getElementById('modal-produto').classList.add('active');
  },

  fecharModal() {
    document.getElementById('modal-produto').classList.remove('active');
    document.getElementById('form-produto').reset();
  },

  async editar(rowKey) {
    try {
      const p = await Produtos.buscarPorId(rowKey);
      this.abrirModal(p);
    } catch (e) { showToast('Erro ao carregar produto', 'error'); }
  },

  async excluir(rowKey, nome) {
    if (!confirm(`Excluir "${nome}"?`)) return;
    try {
      await Produtos.excluir(rowKey);
      showToast('Produto excluído!');
      this.carregar();
    } catch (e) { showToast('Erro ao excluir', 'error'); }
  },

  async salvar() {
    const btn = document.getElementById('btn-salvar-produto');
    const rowKey = document.getElementById('produto-id').value;
    const dados = {
      marca: document.getElementById('produto-marca').value.trim(),
      modelo: document.getElementById('produto-modelo').value.trim(),
      descricao: document.getElementById('produto-descricao').value.trim(),
      preco: document.getElementById('produto-preco').value,
      quantidade: document.getElementById('produto-quantidade').value
    };

    if (!dados.marca || !dados.modelo || !dados.preco || !dados.quantidade) {
      showToast('Preencha todos os campos obrigatórios', 'error'); return;
    }

    const fileInput = document.getElementById('produto-foto');
    const arquivo = fileInput.files[0] || null;
    showLoading(btn, 'Salvando...');

    try {
      if (rowKey) { await Produtos.atualizar(rowKey, dados, arquivo); showToast('Produto atualizado!'); }
      else { await Produtos.cadastrar(dados, arquivo); showToast('Produto cadastrado!'); }
      this.fecharModal();
      this.carregar();
    } catch (e) {
      showToast(`Erro: ${e.message}`, 'error');
    } finally { hideLoading(btn); }
  }
};