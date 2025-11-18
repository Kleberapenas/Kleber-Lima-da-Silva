import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Produto {
  id: string;
  nome: string;
  codigo: string;
  estoque_atual: number;
  estoque_minimo: number;
}

interface Movimentacao {
  id: string;
  produto_id: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  estoque_anterior: number;
  estoque_posterior: number;
  motivo: string | null;
  observacoes: string | null;
  data_movimentacao: string;
  produtos: {
    nome: string;
    codigo: string;
  };
  profiles: {
    nome: string;
  };
}

export default function Movimentacoes() {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    produto_id: "",
    tipo: "entrada" as "entrada" | "saida",
    quantidade: "",
    motivo: "",
    observacoes: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: produtosData } = await supabase
        .from("produtos")
        .select("id, nome, codigo, estoque_atual, estoque_minimo")
        .eq("ativo", true)
        .order("nome");

      const { data: movimentacoesData } = await supabase
        .from("movimentacoes")
        .select(`
          *,
          produtos:produto_id(nome, codigo),
          profiles:usuario_id(nome)
        `)
        .order("data_movimentacao", { ascending: false })
        .limit(50);

      if (produtosData) setProdutos(produtosData);
      if (movimentacoesData) setMovimentacoes(movimentacoesData as any);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.produto_id || !formData.quantidade || !formData.motivo) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const quantidade = parseInt(formData.quantidade);
    if (quantidade <= 0) {
      toast.error("A quantidade deve ser maior que zero");
      return;
    }

    setLoading(true);

    try {
      // Buscar produto atual
      const { data: produto } = await supabase
        .from("produtos")
        .select("estoque_atual")
        .eq("id", formData.produto_id)
        .single();

      if (!produto) {
        toast.error("Produto não encontrado");
        return;
      }

      const estoqueAnterior = produto.estoque_atual;
      const estoquePosterior = formData.tipo === "entrada"
        ? estoqueAnterior + quantidade
        : estoqueAnterior - quantidade;

      if (estoquePosterior < 0) {
        toast.error("Estoque insuficiente para esta operação");
        setLoading(false);
        return;
      }

      // Registrar movimentação
      const { error: movError } = await supabase
        .from("movimentacoes")
        .insert({
          produto_id: formData.produto_id,
          usuario_id: user!.id,
          tipo: formData.tipo,
          quantidade,
          estoque_anterior: estoqueAnterior,
          estoque_posterior: estoquePosterior,
          motivo: formData.motivo,
          observacoes: formData.observacoes || null
        });

      if (movError) throw movError;

      // Atualizar estoque do produto
      const { error: prodError } = await supabase
        .from("produtos")
        .update({ estoque_atual: estoquePosterior })
        .eq("id", formData.produto_id);

      if (prodError) throw prodError;

      toast.success("Movimentação registrada com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        produto_id: "",
        tipo: "entrada",
        quantidade: "",
        motivo: "",
        observacoes: ""
      });
      loadData();
    } catch (error) {
      console.error("Erro ao registrar movimentação:", error);
      toast.error("Erro ao registrar movimentação");
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = produtos.find(p => p.id === formData.produto_id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Movimentações de Estoque</h1>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Movimentação
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Movimentações</CardTitle>
            <CardDescription>
              Últimas 50 movimentações de entrada e saída
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Estoque Após</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhuma movimentação registrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    movimentacoes.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-sm">
                          {format(new Date(mov.data_movimentacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{mov.produtos.nome}</p>
                            <p className="text-sm text-muted-foreground">{mov.produtos.codigo}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={mov.tipo === "entrada" ? "default" : "secondary"}
                            className="gap-1"
                          >
                            {mov.tipo === "entrada" ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {mov.tipo === "entrada" ? "Entrada" : "Saída"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {mov.quantidade}
                        </TableCell>
                        <TableCell className="text-sm">{mov.motivo}</TableCell>
                        <TableCell className="text-sm">{mov.profiles.nome}</TableCell>
                        <TableCell className="text-right font-medium">
                          {mov.estoque_posterior}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Dialog de Movimentação */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Movimentação</DialogTitle>
            <DialogDescription>
              Registre uma entrada ou saída de produtos
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="produto">Produto *</Label>
              <Select
                value={formData.produto_id}
                onValueChange={(value) => setFormData({ ...formData, produto_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((produto) => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.codigo} - {produto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedProduct && (
                <div className="text-sm text-muted-foreground">
                  Estoque atual: {selectedProduct.estoque_atual}
                  {selectedProduct.estoque_atual <= selectedProduct.estoque_minimo && (
                    <Badge variant="destructive" className="ml-2">
                      Abaixo do mínimo
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: "entrada" | "saida") =>
                    setFormData({ ...formData, tipo: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min="1"
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo *</Label>
              <Input
                id="motivo"
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                placeholder="Ex: Compra, Venda, Produção"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Informações adicionais..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Registrando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
