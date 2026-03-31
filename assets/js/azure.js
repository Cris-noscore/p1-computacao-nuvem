// =============================================
// AZURE CONFIGURATION
// =============================================
const AZURE = {
  account: 'stocompnuvem2p1',
  sasToken: 'sv=2024-11-04&ss=bt&srt=sco&sp=rwdlacuiytfx&se=2026-04-20T06:27:11Z&st=2026-03-30T22:12:11Z&spr=https&sig=7cD%2Fck%2BAQOAuUVgfTttGvZYPjA2GarxNhuOD2avf18w%3D',
  blobBase: 'https://stocompnuvem2p1.blob.core.windows.net',
  tableBase: 'https://stocompnuvem2p1.table.core.windows.net',
  containers: { produtos: 'cristianosilveira', imagens: 'cristianosilveira' },
  tables: { produtos: 'CristianoP', clientes: 'CristianoC', pedidos: 'CristianoO' }
};

// =============================================
// BLOB STORAGE HELPERS
// =============================================
const BlobService = {
  async uploadImage(container, blobName, file) {
    const url = `${AZURE.blobBase}/${container}/${blobName}?${AZURE.sasToken}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.type,
        'Content-Length': file.size
      },
      body: file
    });
    if (!res.ok) throw new Error(`Upload falhou: ${res.status}`);
    return `${AZURE.blobBase}/${container}/${blobName}`;
  },

  async deleteBlob(container, blobName) {
    const url = `${AZURE.blobBase}/${container}/${blobName}?${AZURE.sasToken}`;
    await fetch(url, { method: 'DELETE' });
  },

  generateBlobName(file) {
    const ext = file.name.split('.').pop();
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
  }
};

// =============================================
// TABLE STORAGE HELPERS
// =============================================
const TableService = {
  headers() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json;odata=nometadata',
      'x-ms-version': '2020-12-06',
      'DataServiceVersion': '3.0',
      'MaxDataServiceVersion': '3.0;NetFx'
    };
  },

  async insert(table, entity) {
    const url = `${AZURE.tableBase}/${table}?${AZURE.sasToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(entity)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Inserção falhou: ${res.status} - ${err}`);
    }
    return await res.json();
  },

  async update(table, partitionKey, rowKey, entity) {
    const url = `${AZURE.tableBase}/${table}(PartitionKey='${partitionKey}',RowKey='${rowKey}')?${AZURE.sasToken}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...this.headers(), 'If-Match': '*' },
      body: JSON.stringify(entity)
    });
    if (!res.ok) throw new Error(`Atualização falhou: ${res.status}`);
  },

  async delete(table, partitionKey, rowKey) {
    const url = `${AZURE.tableBase}/${table}(PartitionKey='${partitionKey}',RowKey='${rowKey}')?${AZURE.sasToken}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { ...this.headers(), 'If-Match': '*' }
    });
    if (!res.ok) throw new Error(`Exclusão falhou: ${res.status}`);
  },

  async query(table, filter = '') {
    let url = `${AZURE.tableBase}/${table}?${AZURE.sasToken}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Consulta falhou: ${res.status}`);
    const data = await res.json();
    return data.value || [];
  },

  async getOne(table, partitionKey, rowKey) {
    const url = `${AZURE.tableBase}/${table}(PartitionKey='${partitionKey}',RowKey='${rowKey}')?${AZURE.sasToken}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) return null;
    return await res.json();
  },

  generateRowKey() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

// =============================================
// UI HELPERS
// =============================================
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

function showLoading(btn, text = 'Aguarde...') {
  btn.disabled = true;
  btn._originalText = btn.textContent;
  btn.textContent = text;
}

function hideLoading(btn) {
  btn.disabled = false;
  btn.textContent = btn._originalText;
}

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR');
}