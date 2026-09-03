<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCompilerRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\AnchorMenuBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ArticleListBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\BarChartBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\BlockquoteBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\BreadcrumbsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ButtonsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\CardGridBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ComparisonTableBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ContactBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\CtaBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\DividerBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\DownloadResourcesBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\EventScheduleBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\FaqAccordionBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\FeaturesBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\G7BoardArchiveBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\G7PostDetailBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\G7ProductDetailBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\G7ProductGridBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\G7ProductShowcaseBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\G7RecentPostsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\GalleryBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\HeadingBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\HeroBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\HeroSliderBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\HeroSplitBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\IconListBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ImageBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ImageCarouselBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ImageTextBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\InquiryFormBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\LogoCarouselBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\LogoCloudBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\MapDirectionsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\NoticeBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\PricingBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ProcessTimelineBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\RichTextBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\SocialLinksBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\StatsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\TabsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\TeamBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\TestimonialsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\TestimonialSliderBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\VideoEmbedBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;

final readonly class BuiltInBlockCompilers
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private CompilationUrlPolicy $urls,
        private BlockIconCompiler $icons,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function registerDefaults(BlockCompilerRegistry $registry): void
    {
        /** @var array<string, BlockTypeCompilerPort> $compilers */
        $compilers = [
            'builtin.hero-centered-01' => new HeroBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.features-grid-01' => new FeaturesBlockCompiler($this->properties, $this->appearance, $this->icons, $this->escaper, $this->richText),
            'builtin.cta-split-01' => new CtaBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.contact-info-01' => new ContactBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.hero-split-01' => new HeroSplitBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.hero-slider-01' => new HeroSliderBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.logo-cloud-01' => new LogoCloudBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.stats-icons-01' => new StatsBlockCompiler($this->properties, $this->appearance, $this->markup, $this->icons, $this->escaper, $this->richText),
            'builtin.pricing-tiers-01' => new PricingBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.team-grid-01' => new TeamBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.gallery-grid-01' => new GalleryBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper),
            'builtin.bar-chart-01' => new BarChartBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.g7-board-recent-posts-01' => new G7RecentPostsBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper),
            'builtin.g7-ecommerce-product-grid-01' => new G7ProductGridBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper),
            'builtin.inquiry-form-01' => new InquiryFormBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.map-directions-01' => new MapDirectionsBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.testimonials-01' => new TestimonialsBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.faq-accordion-01' => new FaqAccordionBlockCompiler($this->properties, $this->appearance, $this->markup, $this->richText),
            'builtin.process-timeline-01' => new ProcessTimelineBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.tabs-01' => new TabsBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.comparison-table-01' => new ComparisonTableBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.article-list-01' => new ArticleListBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.video-embed-01' => new VideoEmbedBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.logo-carousel-01' => new LogoCarouselBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.testimonial-slider-01' => new TestimonialSliderBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.event-schedule-01' => new EventScheduleBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.download-resources-01' => new DownloadResourcesBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.g7-board-content-archive-01' => new G7BoardArchiveBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper),
            'builtin.g7-ecommerce-product-showcase-01' => new G7ProductShowcaseBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper),
            'builtin.g7-board-post-detail-01' => new G7PostDetailBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper),
            'builtin.g7-ecommerce-product-detail-01' => new G7ProductDetailBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper),
            'builtin.heading-01' => new HeadingBlockCompiler($this->properties, $this->appearance, $this->escaper, $this->richText),
            'builtin.rich-text-01' => new RichTextBlockCompiler($this->properties, $this->appearance, $this->richText),
            'builtin.image-01' => new ImageBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper),
            'builtin.buttons-01' => new ButtonsBlockCompiler($this->properties, $this->appearance, $this->urls, $this->escaper),
            'builtin.image-text-01' => new ImageTextBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.icon-list-01' => new IconListBlockCompiler($this->properties, $this->appearance, $this->markup, $this->icons, $this->escaper, $this->richText),
            'builtin.divider-01' => new DividerBlockCompiler($this->properties, $this->appearance, $this->escaper),
            'builtin.blockquote-01' => new BlockquoteBlockCompiler($this->properties, $this->appearance, $this->escaper, $this->richText),
            'builtin.notice-01' => new NoticeBlockCompiler($this->properties, $this->appearance, $this->urls, $this->escaper, $this->richText),
            'builtin.card-grid-01' => new CardGridBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.breadcrumbs-01' => new BreadcrumbsBlockCompiler($this->properties, $this->appearance, $this->urls, $this->escaper),
            'builtin.anchor-menu-01' => new AnchorMenuBlockCompiler($this->properties, $this->appearance, $this->escaper),
            'builtin.social-links-01' => new SocialLinksBlockCompiler($this->properties, $this->appearance, $this->urls, $this->icons, $this->escaper, $this->richText),
            'builtin.image-carousel-01' => new ImageCarouselBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
        ];

        foreach ($compilers as $key => $compiler) {
            if (! $registry->has($key)) {
                $registry->register($compiler);
            }
        }
    }
}
