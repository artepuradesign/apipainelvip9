<?php
require_once __DIR__ . '/BaseModel.php';

class PdfRg extends BaseModel {
    protected $table = 'pdf_rg_pedidos';

    public function __construct($db) {
        parent::__construct($db);
    }

    public function criarPedido($data) {
        $cpf = preg_replace('/\D/', '', (string)($data['cpf'] ?? ''));
        if ($cpf === '') {
            throw new Exception('CPF é obrigatório');
        }

        $payload = [
            'module_id'          => (int)($data['module_id'] ?? 0),
            'user_id'            => isset($data['user_id']) ? (int)$data['user_id'] : null,
            'cpf'                => $cpf,
            'nome'               => trim($data['nome'] ?? '') ?: null,
            'dt_nascimento'      => $data['dt_nascimento'] ?? null,
            'naturalidade'       => trim($data['naturalidade'] ?? '') ?: null,
            'filiacao_mae'       => trim($data['filiacao_mae'] ?? '') ?: null,
            'filiacao_pai'       => trim($data['filiacao_pai'] ?? '') ?: null,
            'diretor'            => $data['diretor'] ?? null,
            'assinatura_base64'  => $data['assinatura_base64'] ?? null,
            'foto_base64'        => $data['foto_base64'] ?? null,
            'anexo1_base64'      => $data['anexo1_base64'] ?? null,
            'anexo1_nome'        => $data['anexo1_nome'] ?? null,
            'anexo2_base64'      => $data['anexo2_base64'] ?? null,
            'anexo2_nome'        => $data['anexo2_nome'] ?? null,
            'anexo3_base64'      => $data['anexo3_base64'] ?? null,
            'anexo3_nome'        => $data['anexo3_nome'] ?? null,
            'qr_plan'            => $data['qr_plan'] ?? '1m',
            'status'             => 1,
            'preco_pago'         => (float)($data['preco_pago'] ?? 0),
            'desconto_aplicado'  => (float)($data['desconto_aplicado'] ?? 0),
            'created_at'         => date('Y-m-d H:i:s'),
            'updated_at'         => date('Y-m-d H:i:s'),
        ];

        foreach ($payload as $k => $v) {
            if ($v === '') $payload[$k] = null;
        }

        return parent::create($payload);
    }

    public function listarPedidos($userId = null, $status = null, $limit = 20, $offset = 0, $search = null) {
        $where = [];
        $params = [];

        if ($userId !== null) {
            $where[] = 'user_id = ?';
            $params[] = $userId;
        }
        if ($status !== null) {
            $where[] = 'status = ?';
            $params[] = (int)$status;
        }
        if ($search) {
            $where[] = '(nome LIKE ? OR cpf LIKE ?)';
            $params[] = '%' . $search . '%';
            $params[] = '%' . preg_replace('/\D/', '', $search) . '%';
        }

        $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        $query = "SELECT id, module_id, user_id, cpf, nome, dt_nascimento, naturalidade,
                         filiacao_mae, filiacao_pai, diretor, qr_plan, status,
                         preco_pago, desconto_aplicado,
                         anexo1_nome, anexo2_nome, anexo3_nome,
                         pdf_entrega_nome,
                         created_at, updated_at
                  FROM {$this->table} {$whereSql}
                  ORDER BY id DESC LIMIT ? OFFSET ?";

        $params[] = (int)$limit;
        $params[] = (int)$offset;

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function contarPedidos($userId = null, $status = null, $search = null) {
        $where = [];
        $params = [];

        if ($userId !== null) {
            $where[] = 'user_id = ?';
            $params[] = $userId;
        }
        if ($status !== null) {
            $where[] = 'status = ?';
            $params[] = (int)$status;
        }
        if ($search) {
            $where[] = '(nome LIKE ? OR cpf LIKE ?)';
            $params[] = '%' . $search . '%';
            $params[] = '%' . preg_replace('/\D/', '', $search) . '%';
        }

        $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';
        $query = "SELECT COUNT(*) as count FROM {$this->table} {$whereSql}";
        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)($row['count'] ?? 0);
    }

    public function obterPedido($id) {
        $query = "SELECT * FROM {$this->table} WHERE id = ?";
        $stmt = $this->db->prepare($query);
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function atualizarStatus($id, $status, $extraData = []) {
        $sets = ['status = ?', 'updated_at = ?'];
        $params = [(int)$status, date('Y-m-d H:i:s')];

        if (isset($extraData['pdf_entrega_base64'])) {
            $sets[] = 'pdf_entrega_base64 = ?';
            $params[] = $extraData['pdf_entrega_base64'];
        }
        if (isset($extraData['pdf_entrega_nome'])) {
            $sets[] = 'pdf_entrega_nome = ?';
            $params[] = $extraData['pdf_entrega_nome'];
        }

        $params[] = (int)$id;
        $query = "UPDATE {$this->table} SET " . implode(', ', $sets) . " WHERE id = ?";
        $stmt = $this->db->prepare($query);
        return $stmt->execute($params);
    }

    public function deletarPedido($id) {
        $query = "DELETE FROM {$this->table} WHERE id = ?";
        $stmt = $this->db->prepare($query);
        return $stmt->execute([$id]);
    }
}
