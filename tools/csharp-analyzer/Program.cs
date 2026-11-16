using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

// Only JSON snapshots enter this process. No MSBuild workspace, project loading,
// analyzers, generators, or user assemblies are executed.
var json = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };
try
{
    var input = JsonSerializer.Deserialize<Input>(await Console.In.ReadToEndAsync(), json) ?? new();
    var result = new Analyzer().Run(input);
    Console.Write(JsonSerializer.Serialize(result, json));
}
catch (Exception e) { Console.Error.WriteLine("C# analysis failed: " + e.Message); Environment.ExitCode = 1; }

record Source(string Path, string Text, string Assembly = "Assembly-CSharp");
record AssemblyInput(string Name, string[] References);
class Input { public Source[] Sources { get; set; } = []; public AssemblyInput[] Assemblies { get; set; } = []; }
record Location(string File, int Line);
class GraphNode
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "";
    public string File { get; set; } = "";
    public int Line { get; set; }
    public string? Parent { get; set; }
    public string? Assembly { get; set; }
    public string? QualifiedName { get; set; }
    public List<Location> Declarations { get; set; } = [];
}
record Edge(string Id, string A, string B, string Kind, string File, int Line, string Evidence = "static");
record Unresolved(string File, int Line, string Kind, string Name);
class Result
{
    public List<GraphNode> Nodes { get; } = [];
    public List<Edge> Edges { get; } = [];
    public List<Unresolved> Unresolved { get; } = [];
    public int UnresolvedCount { get; set; }
    public int ParseErrors { get; set; }
    public int SemanticErrors { get; set; }
    public int ConditionalFiles { get; set; }
    public bool Truncated { get; set; }
}
class Analyzer
{
    readonly Result result = new();
    readonly Dictionary<string, GraphNode> nodes = new();
    readonly Dictionary<SyntaxNode, string> declarations = new();
    readonly HashSet<string> edgeKeys = [];
    readonly Dictionary<string, CSharpCompilation> compilations = new();
    const int MaxNodes = 20000, MaxEdges = 60000;
    static readonly SymbolDisplayFormat Display = SymbolDisplayFormat.CSharpErrorMessageFormat;
    static int Line(SyntaxNode n) => n.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
    static string File(SyntaxNode n) => n.SyntaxTree.FilePath;
    static ISymbol Normalize(ISymbol s) => s is IMethodSymbol m ? (m.ReducedFrom ?? m).OriginalDefinition : s.OriginalDefinition;
    static string SymbolId(ISymbol symbol)
    {
        var s = Normalize(symbol);
        var key = s.GetDocumentationCommentId();
        if(key != null) return "csharp:" + s.ContainingAssembly?.Name + ":" + key;
        var syntax = s.DeclaringSyntaxReferences.FirstOrDefault()?.GetSyntax();
        var container = s.ContainingSymbol?.GetDocumentationCommentId() ?? s.ContainingSymbol?.ToDisplayString(Display) ?? "";
        var owner = s.ContainingSymbol?.DeclaringSyntaxReferences.FirstOrDefault()?.GetSyntax();
        string? Name(SyntaxNode n) => n switch { VariableDeclaratorSyntax v=>v.Identifier.ValueText, ParameterSyntax p=>p.Identifier.ValueText, _=>null };
        var ordinal = owner?.DescendantNodes().Count(n=>n.RawKind==syntax?.RawKind && n.SpanStart<syntax?.SpanStart && Name(n)==s.Name) ?? 0;
        return "csharp:" + s.ContainingAssembly?.Name + ":" + container + ":" + s.Kind + ":" + s.Name + ":" + syntax?.SyntaxTree.FilePath + ":" + ordinal;
    }
    string? Add(GraphNode node)
    {
        if(nodes.ContainsKey(node.Id)) return node.Id;
        if(nodes.Count >= MaxNodes) { result.Truncated = true; return null; }
        nodes[node.Id] = node; result.Nodes.Add(node); return node.Id;
    }
    void Unknown(SyntaxNode n, string kind, string name)
    {
        result.UnresolvedCount++;
        if(result.Unresolved.Count < 300) result.Unresolved.Add(new(File(n), Line(n), kind, name.Length > 160 ? name[..160] : name));
    }
    void Link(string? a, string? b, string kind, SyntaxNode evidence)
    {
        if(a == null || b == null || a == b || !nodes.ContainsKey(a) || !nodes.ContainsKey(b)) return;
        if(result.Edges.Count >= MaxEdges) { result.Truncated = true; return; }
        var key = a + "|" + b + "|" + kind + "|" + File(evidence) + "|" + Line(evidence);
        if(edgeKeys.Add(key)) result.Edges.Add(new("cs-e" + result.Edges.Count, a, b, kind, File(evidence), Line(evidence)));
    }
    static string? Kind(SyntaxNode n) => n switch
    {
        ClassDeclarationSyntax => "class", InterfaceDeclarationSyntax => "interface", StructDeclarationSyntax => "struct",
        RecordDeclarationSyntax r => r.ClassOrStructKeyword.IsKind(SyntaxKind.StructKeyword) ? "struct" : "class",
        EnumDeclarationSyntax => "enum", DelegateDeclarationSyntax => "type",
        BaseMethodDeclarationSyntax or LocalFunctionStatementSyntax => "method",
        PropertyDeclarationSyntax or IndexerDeclarationSyntax => "property", EventDeclarationSyntax => "event",
        VariableDeclaratorSyntax v => v.Parent?.Parent is EventFieldDeclarationSyntax ? "event" : v.Parent?.Parent is FieldDeclarationSyntax ? "field" : "variable",
        ParameterSyntax => "parameter", _ => null
    };
    void Declare(SyntaxNode n, SemanticModel model, string parent)
    {
        var kind = Kind(n);
        if(kind != null && model.GetDeclaredSymbol(n) is ISymbol symbol)
        {
            var id = SymbolId(symbol);
            if(nodes.TryGetValue(id, out var existing)) existing.Declarations.Add(new(File(n), Line(n)));
            else id = Add(new() { Id=id, Name=symbol is IMethodSymbol m && m.MethodKind==MethodKind.Constructor ? symbol.ContainingType.Name : symbol.Name,
                Kind=kind, File=File(n), Line=Line(n), Parent=parent, Assembly=symbol.ContainingAssembly?.Name,
                QualifiedName=symbol.ToDisplayString(Display), Declarations=[new(File(n),Line(n))] }) ?? "";
            if(id != "") { declarations[n]=id; parent=id; }
        }
        foreach(var child in n.ChildNodes()) Declare(child,model,parent);
    }
    string? Target(SyntaxNode n, SemanticModel model)
    {
        // Candidates are deliberately excluded: ambiguous overloads are not confirmed edges.
        var symbol = model.GetSymbolInfo(n).Symbol;
        if(symbol is IAliasSymbol alias) symbol = alias.Target;
        if(symbol == null) return null;
        var id = SymbolId(symbol);
        return nodes.ContainsKey(id) ? id : null;
    }
    void Read(SyntaxNode n, SemanticModel model, string owner)
    {
        if(declarations.TryGetValue(n,out var own)) owner=own;
        if(n is BaseTypeSyntax baseType)
        {
            var target=Target(baseType.Type,model);
            if(target != null) Link(owner,target,nodes[target].Kind=="interface" && nodes[owner].Kind!="interface"?"implements":"extends",n);
            else Unknown(n,"heritage",baseType.Type.ToString());
        }
        if(n is InvocationExpressionSyntax call)
        {
            var target=Target(call,model);
            if(target != null) Link(owner,target,"calls",call);
            else Unknown(call,"call",call.Expression.ToString());
        }
        if(n is BaseObjectCreationExpressionSyntax creation)
        {
            var symbol=model.GetSymbolInfo(creation).Symbol as IMethodSymbol;
            var target=symbol == null ? null : SymbolId(symbol.ContainingType);
            if(target != null && nodes.ContainsKey(target)) Link(owner,target,"constructs",creation);
            else Unknown(creation,"constructs",creation.ToString());
        }
        if(n is IdentifierNameSyntax || n is GenericNameSyntax)
        {
            var target=Target(n,model);
            if(target != null)
            {
                var variable=nodes[target].Kind is "field" or "property" or "variable" or "parameter" or "event";
                SyntaxNode expression=n;
                if(n.Parent is MemberAccessExpressionSyntax member && member.Name==n) expression=member;
                else if(n.Parent is MemberBindingExpressionSyntax binding && binding.Name==n) expression=binding;
                var assignment=expression.Parent as AssignmentExpressionSyntax;
                var write=assignment?.Left==expression;
                var update=expression.Parent is PrefixUnaryExpressionSyntax pre && (pre.IsKind(SyntaxKind.PreIncrementExpression)||pre.IsKind(SyntaxKind.PreDecrementExpression))
                    || expression.Parent is PostfixUnaryExpressionSyntax post && (post.IsKind(SyntaxKind.PostIncrementExpression)||post.IsKind(SyntaxKind.PostDecrementExpression));
                var argument=expression.Parent as ArgumentSyntax;
                var outArg=argument?.RefKindKeyword.IsKind(SyntaxKind.OutKeyword)==true;
                var refArg=argument?.RefKindKeyword.IsKind(SyntaxKind.RefKeyword)==true;
                if(!variable) Link(owner,target,"references",n);
                else
                {
                    if(!write && !outArg || assignment != null && !assignment.IsKind(SyntaxKind.SimpleAssignmentExpression)) Link(owner,target,"reads",n);
                    if(write||update||outArg||refArg) Link(owner,target,"writes",n);
                }
            }
        }
        foreach(var child in n.ChildNodes()) Read(child,model,owner);
    }
    public Result Run(Input input)
    {
        var groups=input.Sources.GroupBy(s=>s.Assembly).ToDictionary(g=>g.Key,g=>g.ToArray());
        var definitions=input.Assemblies.GroupBy(a=>a.Name).ToDictionary(g=>g.Key,g=>g.First().References);
        var platform=((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") ?? "").Split(Path.PathSeparator).Where(p=>p.EndsWith(".dll"));
        var references=platform.Select(p=>MetadataReference.CreateFromFile(p)).Cast<MetadataReference>().ToArray();
        var trees=groups.ToDictionary(g=>g.Key,g=>g.Value.Select(s=>CSharpSyntaxTree.ParseText(s.Text,new CSharpParseOptions(LanguageVersion.Latest),s.Path)).ToArray());
        CSharpCompilation Build(string name, HashSet<string> chain)
        {
            if(compilations.TryGetValue(name,out var found)) return found;
            chain.Add(name);
            var deps=new List<MetadataReference>(references);
            foreach(var dependency in definitions.GetValueOrDefault(name,[]))
                if(groups.ContainsKey(dependency) && !chain.Contains(dependency)) deps.Add(Build(dependency,new(chain)).ToMetadataReference());
            var c=CSharpCompilation.Create(name,trees[name],deps,new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary,allowUnsafe:true));
            compilations[name]=c; return c;
        }
        foreach(var group in groups.Keys) Build(group,[]);
        foreach(var (name,compilation) in compilations)
        {
            foreach(var tree in compilation.SyntaxTrees)
            {
                Add(new() { Id="file:"+tree.FilePath, Name=tree.FilePath, Kind="file", File=tree.FilePath, Line=1, Assembly=name });
                var root=tree.GetRoot();
                result.ParseErrors += tree.GetDiagnostics().Count(d=>d.Severity==DiagnosticSeverity.Error);
                if(root.DescendantTrivia(descendIntoTrivia:true).Any(t=>t.IsKind(SyntaxKind.IfDirectiveTrivia))) result.ConditionalFiles++;
                Declare(root,compilation.GetSemanticModel(tree),"file:"+tree.FilePath);
            }
            result.SemanticErrors += compilation.GetDiagnostics().Count(d=>d.Severity==DiagnosticSeverity.Error);
        }
        foreach(var compilation in compilations.Values) foreach(var tree in compilation.SyntaxTrees) Read(tree.GetRoot(),compilation.GetSemanticModel(tree),"file:"+tree.FilePath);
        return result;
    }
}
