<?php

declare(strict_types=1);

namespace Polyspec\HttpMediaType\Tests;

use PHPUnit\Framework\TestCase;
use Polyspec\HttpMediaType\MediaType as M;

/**
 * The contract cases of http-media-type run with the extension loaded (MT-1 to MT-8). HTTP_MEDIA_TYPE_CASES is the
 * path of contracts/media-type.json, which make test-php sets. A value of the cases is latin1 (MT-1.1): its characters
 * U+0000 to U+00FF are the bytes of a PHP string; a name is a text, a UTF-8 string.
 */
final class CasesTest extends TestCase
{
    /** @return array<string, list<array<string, mixed>>> */
    private static function cases(): array
    {
        $path = getenv('HTTP_MEDIA_TYPE_CASES');
        self::assertIsString($path);
        $cases = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($cases);
        return $cases;
    }

    private static function latin1(string $text): string
    {
        return mb_convert_encoding($text, 'ISO-8859-1', 'UTF-8');
    }

    /** @return array<string, mixed> */
    private static function plain(M\MediaType $mediaType): array
    {
        $parameters = [];
        foreach ($mediaType->parameters as $parameter) {
            $parameters[] = ['name' => $parameter->name, 'value' => $parameter->value];
        }
        return ['type' => $mediaType->type, 'subtype' => $mediaType->subtype, 'parameters' => $parameters];
    }

    /** @param array<string, mixed> $value */
    private static function bytes(array $value): array
    {
        return [
            'type' => $value['type'],
            'subtype' => $value['subtype'],
            'parameters' => array_map(
                static fn (array $p): array => ['name' => $p['name'], 'value' => self::latin1($p['value'])],
                $value['parameters'],
            ),
        ];
    }

    /** @param array<string, mixed> $case */
    private static function raises(array $case, callable $call): void
    {
        $raises = $case['raises'];
        try {
            $call();
            self::fail('no error: ' . $case['id']);
        } catch (\Throwable $error) {
            $class = 'Polyspec\\HttpMediaType\\MediaType' . ucfirst($raises['category']) . 'Error';
            self::assertSame($class, $error::class, $case['id']);
            self::assertSame($raises['kind'], $error->kind(), $case['id']);
            self::assertSame($raises['status'], $error->status(), $case['id']);
            if ($raises['message'] !== null) {
                self::assertSame($raises['message'], $error->getMessage(), $case['id']);
            }
        }
    }

    public function testParse(): void
    {
        $group = self::cases()['parse'];
        self::assertNotEmpty($group);
        foreach ($group as $case) {
            $call = static fn (): M\MediaType => M\parse(self::latin1($case['value']));
            if (isset($case['raises'])) {
                self::raises($case, $call);
            } else {
                self::assertSame(self::bytes($case['media_type']), self::plain($call()), $case['id']);
            }
        }
    }

    public function testFormat(): void
    {
        $group = self::cases()['format'];
        self::assertNotEmpty($group);
        foreach ($group as $case) {
            $m = self::bytes($case['media_type']);
            $parameters = array_map(static fn (array $p): M\Parameter => new M\Parameter(name: $p['name'], value: $p['value']), $m['parameters']);
            $call = static fn (): string => M\format(type: $m['type'], subtype: $m['subtype'], parameters: $parameters);
            if (isset($case['raises'])) {
                self::raises($case, $call);
            } else {
                self::assertSame(self::latin1($case['text']), $call(), $case['id']);
            }
        }
    }

    public function testSameValue(): void
    {
        $group = self::cases()['sameValue'];
        self::assertNotEmpty($group);
        foreach ($group as $case) {
            $same = M\sameValue($case['name'], self::latin1($case['left']), self::latin1($case['right']));
            self::assertSame($case['same'], $same, $case['id']);
        }
    }
}
