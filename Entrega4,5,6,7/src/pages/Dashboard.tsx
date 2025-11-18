import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingUp, TrendingDown, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface StatsData {
  totalProdutos: number;
  produtosBaixoEstoque: number;
  movimentacoesHoje: number;
  categorias: number;
}

interface ProdutoBaixoEstoque {
  id: string;
  nome: string;
  codigo: string;
  estoque_atual: number;
  estoque_minimo: number;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<StatsData>({
    totalProdutos: 0,
    produtosBaixoEstoque: 0,
    movimentacoesHoje: 0,
    categorias: 0
  });
  const [produtosBaixoEstoque, setProdutosBaixoEstoque] = useState<ProdutoBaixoEstoque[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      // Carregar perfil
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      setProfile(profileData);

      // Carregar estatísticas
      const { data: produtos } = await supabase
        .from("produtos")
        .select("*")
        .eq("ativo", true);

      const { data: categorias } = await supabase
        .from("categorias")
        .select("id");

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const { data: movimentacoes } = await supabase
        .from("movimentacoes")
        .select("id")
        .gte("data_movimentacao", hoje.toISOString());

      const produtosBaixo = produtos?.filter(
        p => p.estoque_atual <= p.estoque_minimo
      ) || [];

      setStats({
        totalProdutos: produtos?.length || 0,
        produtosBaixoEstoque: produtosBaixo.length,
        movimentacoesHoje: movimentacoes?.length || 0,
        categorias: categorias?.length || 0
      });

      setProdutosBaixoEstoque(produtosBaixo.slice(0, 5));
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Sistema de Estoque</h1>
              <p className="text-sm text-muted-foreground">Gestão de Produtos</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-medium">{profile?.nome || "Usuário"}</p>
              <p className="text-sm text-muted-foreground">{profile?.cargo || "Operador"}</p>
            </div>
            <Button variant="outline" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalProdutos}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Em {stats.categorias} categorias
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">
                {stats.produtosBaixoEstoque}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Produtos abaixo do mínimo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Entradas Hoje</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.movimentacoesHoje}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Movimentações registradas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Categorias</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.categorias}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Tipos de produtos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Gestão de Produtos</CardTitle>
              <CardDescription>
                Cadastrar, editar e visualizar produtos do estoque
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/produtos">
                <Button className="w-full">Gerenciar Produtos</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Movimentações</CardTitle>
              <CardDescription>
                Registrar entradas e saídas de materiais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/movimentacoes">
                <Button className="w-full">Gerenciar Estoque</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Alertas de Estoque Baixo */}
        {produtosBaixoEstoque.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <CardTitle>Alertas de Estoque</CardTitle>
              </div>
              <CardDescription>
                Produtos que precisam de reposição
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {produtosBaixoEstoque.map((produto) => (
                  <div
                    key={produto.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border"
                  >
                    <div>
                      <p className="font-medium">{produto.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        Código: {produto.codigo}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="border-warning text-warning">
                        {produto.estoque_atual} / {produto.estoque_minimo}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
